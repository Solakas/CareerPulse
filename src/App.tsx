import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'motion/react';

import {
  Briefcase,
  Settings,
  History as HistoryIcon,
  ChevronRight,
  Save,
  Trash2,
  Loader2,
  Upload,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  X,
  Check,
  Eye,
  Search,
  Filter,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Target,
  Clock,
  User as UserIcon,
  Link as LinkIcon,
  FileText
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import TextareaAutosize from 'react-textarea-autosize';
import { analyzeJobPosting, analyzeJobImage, analyzeCV } from './services/geminiService';
import { View, Preferences, Review, Profile, GuestUser } from './types';
import { db, auth } from './lib/firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { Auth } from './components/Auth';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { LogOut, ArrowUp, ArrowDown, ArrowUpDown, HelpCircle } from 'lucide-react';

const OPTIONS = {
  company_type: ['Product Company', 'Startup (Seed/Series A)', 'Scaleup (Series B+)', 'Enterprise', 'Agency', 'Consultancy', 'Public Sector', 'Non-Profit'],
  domain_focus: ['FinTech', 'HealthTech', 'EdTech', 'Cybersecurity', 'E-commerce', 'SaaS', 'AI/ML', 'Web3/Crypto', 'Gaming', 'PropTech', 'AdTech', 'Logistics', 'Sustainability'],
  local_base: ['Athens, Greece', 'London, UK', 'Berlin, Germany', 'Paris, France', 'Amsterdam, Netherlands', 'New York, USA', 'San Francisco, USA', 'Remote'],
  working_model: ['100% Remote (Global)', '100% Remote (Country-specific)', 'Hybrid (1-2 days/week)', 'Hybrid (3+ days/week)', 'On-site only'],
  local_salary_target: ['€1,000 - €1,500', '€1,500 - €2,000', '€2,000 - €2,500', '€2,500 - €3,000', '€3,000 - €3,500', '€3,500+'],
  int_salary_target: ['€3,500 - €4,500', '€4,500 - €5,500', '€5,500 - €6,500', '€6,500 - €7,500', '€7,500+'],
  tech_maturity: ['High (Design Systems, CI/CD, Unit Testing)', 'Medium (Established processes, some automation)', 'Growth (Building foundations, rapid scaling)', 'Early (Fast-paced, minimal processes)', 'Legacy (Maintaining established systems)'],
  status: ['Pending', '1st Interview', 'Assignment', '2nd Interview', '3rd Interview', 'Final Interview', 'No Response', 'Rejected']
};

function AutocompleteMultiSelect({ label, value, options, onChange }: {
  label: string,
  value: string | undefined,
  options: string[],
  onChange: (val: string) => void
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const selected = value ? value.split('|').filter(Boolean) : [];

  const filteredOptions = options.filter(opt =>
    opt.toLowerCase().includes(query.toLowerCase()) && !selected.includes(opt)
  );

  const toggle = (opt: string) => {
    const newSelected = selected.includes(opt)
      ? selected.filter(s => s !== opt)
      : [...selected, opt];
    onChange(newSelected.join('|'));
    setQuery('');
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim()) {
      e.preventDefault();
      if (!selected.includes(query.trim())) {
        toggle(query.trim());
      }
    }
  };

  return (
    <div className="space-y-1.5 relative">
      <label className="text-[10px] font-bold uppercase tracking-widest text-black ml-1">{label}</label>

      <div className="min-h-[48px] p-2 rounded-lg border border-border bg-white focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all flex flex-wrap gap-2 items-center">
        {selected.map(s => (
          <span key={s} className="flex items-center gap-1.5 px-3 py-1 bg-accent/50 text-accent-foreground rounded-md text-sm font-medium transition-colors hover:bg-accent">
            {s}
            <button type="button" onClick={() => toggle(s)} className="hover:text-destructive transition-colors ml-1">
              <X size={14} strokeWidth={2.5} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selected.length === 0 ? "Search or type to add..." : ""}
          className="flex-1 min-w-[120px] outline-none bg-transparent text-sm"
        />
      </div>

      {isOpen && (query || filteredOptions.length > 0) && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute z-20 w-full mt-1 bg-white border border-border rounded-xl shadow-lg max-h-60 overflow-y-auto py-2">
            {filteredOptions.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                className="w-full text-left px-4 py-2 text-sm hover:bg-accent hover:text-secondary transition-colors"
              >
                {opt}
              </button>
            ))}
            {query && !options.includes(query) && !selected.includes(query) && (
              <button
                type="button"
                onClick={() => toggle(query)}
                className="w-full text-left px-4 py-2 text-sm hover:bg-accent hover:text-secondary transition-colors border-t border-border mt-1 italic"
              >
                Add "{query}"
              </button>
            )}
            {filteredOptions.length === 0 && !query && (
              <div className="px-4 py-2 text-sm text-muted-foreground italic">No more options</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

interface TourStep {
  target: string;
  title?: string;
  content: string;
  placement: 'center' | 'top' | 'bottom' | 'left' | 'right';
}

function OnboardingTour({ steps, isOpen, onClose }: { steps: TourStep[], isOpen: boolean, onClose: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  
  useEffect(() => {
    if (!isOpen) return;

    let animationFrameId: number;

    const updatePosition = () => {
      const step = steps[currentIndex];
      if (step.target === 'body') {
        setTargetRect(null);
      } else {
        const el = document.querySelector(step.target);
        if (el) {
          setTargetRect(el.getBoundingClientRect());
        }
      }
      animationFrameId = requestAnimationFrame(updatePosition);
    };

    updatePosition();
    
    const step = steps[currentIndex];
    if (step.target !== 'body') {
        const el = document.querySelector(step.target);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        } else {
            setTimeout(() => {
                const retryEl = document.querySelector(step.target);
                if (retryEl) retryEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            }, 100);
        }
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [currentIndex, isOpen, steps]);

  if (!isOpen) return null;

  const step = steps[currentIndex];
  const isLast = currentIndex === steps.length - 1;

  let top = '50%';
  let left = '50%';
  let x = '-50%';
  let y = '-50%';

  if (targetRect && step.target !== 'body') {
    const margin = 24; 
    
    switch (step.placement) {
      case 'right':
        top = `${targetRect.top + targetRect.height / 2}px`;
        left = `${targetRect.right + margin}px`;
        x = '0%';
        y = '-50%';
        break;
      case 'left':
        top = `${targetRect.top + targetRect.height / 2}px`;
        left = `${targetRect.left - margin}px`;
        x = '-100%';
        y = '-50%';
        break;
      case 'top':
        top = `${targetRect.top - margin}px`;
        left = `${targetRect.left + targetRect.width / 2}px`;
        x = '-50%';
        y = '-100%';
        break;
      case 'bottom':
        top = `${targetRect.bottom + margin}px`;
        left = `${targetRect.left + targetRect.width / 2}px`;
        x = '-50%';
        y = '0%';
        break;
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      <AnimatePresence>
        {isOpen && (
            <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="absolute inset-0 pointer-events-auto transition-all transition-opacity duration-300"
                onClick={() => {}} 
            >
                <svg className="w-full h-full text-black/60">
                    <defs>
                        <mask id="spotlight-mask">
                            {/* White background means fully opaque mask */}
                            <rect width="100%" height="100%" fill="white" />
                            {/* Black rectangle means fully transparent mask (the hole) */}
                            {targetRect && step.target !== 'body' && (
                                <motion.rect 
                                    className="transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                                    x={targetRect.left - 8} 
                                    y={targetRect.top - 8} 
                                    width={targetRect.width + 16} 
                                    height={targetRect.height + 16} 
                                    rx="8" 
                                    fill="black" 
                                />
                            )}
                        </mask>
                    </defs>
                    <rect width="100%" height="100%" fill="currentColor" mask="url(#spotlight-mask)" />
                </svg>
            </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        animate={{ 
          top,
          left,
          x,
          y
        }}
        transition={{
          type: 'spring',
          damping: 25,
          stiffness: 180,
          mass: 1
        }}
        className="absolute w-[350px] bg-white rounded-3xl shadow-2xl border border-border p-6 pointer-events-auto origin-center"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between gap-4">
              {step.title && (
                <h4 className="text-lg font-serif font-bold text-foreground flex items-center gap-2">
                  <Sparkles size={18} className="text-secondary" />
                  {step.title}
                </h4>
              )}
              <button
                onClick={() => { setCurrentIndex(0); onClose(); }}
                className="p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg transition-colors ml-auto"
                title="Skip Tour"
              >
                <X size={18} />
              </button>
            </div>
            <div className="text-[15px] text-muted-foreground leading-relaxed">
              {step.content}
            </div>
            
            <div className="flex items-center justify-between pt-4 mt-2 border-t border-border/50">
              <div className="flex items-center gap-4">
                  <span className="text-[13px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                    {currentIndex + 1} / {steps.length}
                  </span>
              </div>
              <div className="flex gap-2">
                {currentIndex > 0 && (
                  <button
                    onClick={() => setCurrentIndex(i => i - 1)}
                    className="px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted rounded-xl transition-colors"
                  >
                    Back
                  </button>
                )}
                {!isLast ? (
                  <button
                    onClick={() => setCurrentIndex(i => i + 1)}
                    className="px-5 py-2 hover:opacity-90 bg-secondary text-white rounded-xl text-xs font-bold shadow-lg shadow-secondary/20 transition-all active:scale-95"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    onClick={() => { setCurrentIndex(0); onClose(); }}
                    className="px-5 py-2 bg-[#154e24] text-white rounded-xl text-xs font-bold shadow-lg shadow-[#154e24]/20 hover:opacity-90 transition-all active:scale-95"
                  >
                    Finish Tour
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>,
    document.body
  );
}

function StatusDropdown({
  value,
  onChange,
  options
}: {
  value: string,
  onChange: (val: string) => void,
  options: string[]
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      // Calculate position for fixed menu
      setCoords({
        top: rect.top,
        left: rect.left
      });

      setOpenUpwards(spaceBelow < 200 && spaceAbove > spaceBelow);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleScroll = () => setIsOpen(false);
    if (isOpen) {
      window.addEventListener('scroll', handleScroll, true);
    }
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'No Response':
      case 'Rejected':
        return 'bg-red-50 text-red-900 border border-red-200';
      case 'Pending':
        return 'bg-neutral-100 text-neutral-800 border border-neutral-200';
      case '1st Interview':
      case '2nd Interview':
      case '3rd Interview':
        return 'bg-blue-50 text-blue-900 border border-blue-200';
      case 'Assignment':
        return 'bg-amber-50 text-amber-900 border border-amber-200';
      case 'Final Interview':
        return 'bg-emerald-50 text-emerald-900 border border-emerald-200';
      default:
        return 'bg-secondary/10 text-secondary border border-secondary/20';
    }
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-all hover:opacity-80 whitespace-nowrap ${getStatusStyles(value)}`}
      >
        <span>{value || 'Pending'}</span>
        <ChevronRight size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : 'rotate-0'}`} />
      </button>

      {isOpen && createPortal(
        <AnimatePresence mode="wait">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: openUpwards ? 10 : -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: openUpwards ? 10 : -10 }}
            style={{
              position: 'fixed',
              top: openUpwards ? 'auto' : `${coords.top + 36}px`,
              bottom: openUpwards ? `${window.innerHeight - coords.top + 4}px` : 'auto',
              left: `${coords.left}px`,
              width: 'max-content',
              zIndex: 9999
            }}
            className="bg-white border border-border rounded-xl shadow-xl overflow-hidden py-2 min-w-[160px]"
          >
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent focus loss if needed
                  onChange(opt);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold transition-colors ${value === opt ? 'text-secondary bg-accent/50' : 'text-foreground hover:bg-accent'
                  }`}
              >
                {opt}
                {value === opt && <CheckCircle2 size={16} className="text-secondary" />}
              </button>
            ))}
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

function ReviewDetails({ review, onUpdateNotes, onUpdateStatus, updatingNotes, isSaving, onSave }: {
  review: Review,
  onUpdateNotes: (notes: string) => void,
  onUpdateStatus?: (status: string) => void,
  updatingNotes: boolean,
  isSaving?: boolean,
  onSave?: () => void
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
      <div className="bg-accent/30 p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${review.verdict === 'Apply' ? 'bg-emerald-100 text-emerald-700' :
              review.verdict === 'Skip' ? 'bg-rose-100 text-rose-700' :
                'bg-amber-100 text-amber-700'
              }`}>
              {review.verdict}
            </span>
            {onUpdateStatus && (
              <StatusDropdown
                value={review.status || 'Pending'}
                onChange={onUpdateStatus}
                options={OPTIONS.status}
              />
            )}
          </div>
          <h3 className="text-2xl font-serif font-bold text-foreground">{review.job_title}</h3>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground font-medium">
            <span>{review.company_name}</span>
            {review.seniority_level && (
              <span className="flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded text-foreground/70">
                {review.seniority_level}
              </span>
            )}
            {review.salary_info && (
              <span className="flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded text-foreground/70">
                {review.salary_info}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-4xl font-serif font-bold text-secondary">{review.score}%</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Match Score</div>
          </div>
          {onSave && (
            <button
              onClick={onSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-3 bg-white rounded-xl border border-border hover:border-secondary hover:text-secondary transition-all shadow-sm active:scale-95 disabled:opacity-50"
              title="Save to History"
            >
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              <span className="text-sm font-bold">Save</span>
            </button>
          )}
        </div>
      </div>

      <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
        {review.analysis ? review.analysis.map((section, idx) => {
          const cleanTitle = section.title.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E6}-\u{1F1FF}]/gu, '').trim();

          return (
            <div key={idx} className={`space-y-3 p-6 rounded-2xl border border-border/50 bg-muted/5 ${idx === review.analysis.length - 1 && review.analysis.length % 2 !== 0 ? 'md:col-span-2' : ''}`}>
              <h4 className="font-bold flex items-center gap-2 text-foreground">
                <span className="text-xl">{section.icon}</span>
                {cleanTitle}
              </h4>
              <div className="markdown-body text-sm leading-relaxed text-muted-foreground">
                <ReactMarkdown>{section.content}</ReactMarkdown>
              </div>
            </div>
          );
        }) : (
          <div className="md:col-span-2 p-6 bg-muted/5 rounded-2xl border border-border/50">
            <p className="text-muted-foreground italic">This is an older review format. Please re-analyze the job for the new structured view.</p>
          </div>
        )}

        <div className="md:col-span-2 space-y-4 p-8 bg-accent/30 rounded-2xl border border-primary/10">
          <div className="flex items-center justify-between">
            <h4 className="font-serif font-bold text-lg flex items-center gap-2">
              <Plus size={20} className="text-secondary" />
              My Personal Notes
            </h4>
            {review.id && updatingNotes && (
              <Loader2 className="animate-spin text-secondary" size={16} />
            )}
          </div>
          <TextareaAutosize
            defaultValue={review.user_notes || ''}
            onBlur={(e) => onUpdateNotes(e.target.value)}
            placeholder="Add your thoughts, interview dates, or follow-up actions here..."
            minRows={3}
            className="w-full p-4 rounded-xl border border-border bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none text-sm transition-all"
          />
          {!review.id && (
            <p className="text-[10px] text-muted-foreground italic">Notes will be saved once you click the "Save" button above.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function AnimatedNumber({ value }: { value: number | string }) {
  const numericValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.]/g, '')) : value;
  const suffix = typeof value === 'string' && value.includes('%') ? '%' : '';

  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(count, numericValue, { duration: 1.5, ease: "easeOut" });
    return controls.stop;
  }, [numericValue, count]);

  useEffect(() => {
    return rounded.on("change", (latest) => setDisplay(latest));
  }, [rounded]);

  return <>{display}{suffix}</>;
}

function FilterSheet({
  isOpen,
  onClose,
  itemsPerPage,
  setItemsPerPage,
  scoreRange,
  setScoreRange,
  selectedStatuses,
  setSelectedStatuses,
  visibleColumns,
  setVisibleColumns,
  statusOptions
}: {
  isOpen: boolean,
  onClose: () => void,
  itemsPerPage: number,
  setItemsPerPage: (val: number) => void,
  scoreRange: [number, number],
  setScoreRange: (val: [number, number]) => void,
  selectedStatuses: string[],
  setSelectedStatuses: (val: string[]) => void,
  visibleColumns: string[],
  setVisibleColumns: (val: string[]) => void,
  statusOptions: string[]
}) {
  const columns = ['Company', 'Seniority', 'Salary/Equity', 'Score', 'Status', 'Notes', 'Date', 'Actions'];
  const [initialState, setInitialState] = useState<{
    itemsPerPage: number,
    scoreRange: [number, number],
    selectedStatuses: string[],
    visibleColumns: string[]
  } | null>(null);

  const handleReset = () => {
    setItemsPerPage(10);
    setScoreRange([0, 100]);
    setSelectedStatuses([]);
    setVisibleColumns(['Company', 'Seniority', 'Salary/Equity', 'Score', 'Status', 'Notes', 'Date', 'Actions']);
  };

  useEffect(() => {
    if (isOpen) {
      setInitialState({
        itemsPerPage,
        scoreRange: [...scoreRange],
        selectedStatuses: [...selectedStatuses],
        visibleColumns: [...visibleColumns]
      });
    }
  }, [isOpen]);

  const hasChanges = initialState ? (
    itemsPerPage !== initialState.itemsPerPage ||
    scoreRange[0] !== initialState.scoreRange[0] ||
    scoreRange[1] !== initialState.scoreRange[1] ||
    selectedStatuses.length !== initialState.selectedStatuses.length ||
    !selectedStatuses.every(s => initialState.selectedStatuses.includes(s)) ||
    visibleColumns.length !== initialState.visibleColumns.length ||
    !visibleColumns.every(c => initialState.visibleColumns.includes(c))
  ) : false;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
          />
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 left-0 h-full w-full max-w-sm bg-white z-[101] shadow-2xl flex flex-col"
          >
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="text-xl font-serif font-bold">Table Filters</h3>
              <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Displayed Columns */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Visible Columns</h4>
                <div className="grid grid-cols-2 gap-3">
                  {columns.map(col => (
                    <label key={col} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer group transition-colors">
                      <input
                        type="checkbox"
                        checked={visibleColumns.includes(col)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setVisibleColumns([...visibleColumns, col]);
                          } else {
                            setVisibleColumns(visibleColumns.filter(c => c !== col));
                          }
                        }}
                        className="w-5 h-5 rounded border-border text-[#154e24] focus:ring-[#154e24] accent-[#154e24]"
                      />
                      <span className="text-sm font-medium group-hover:text-[#154e24] transition-colors">{col}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Items Per Page */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Results Per Page</h4>
                <div className="flex flex-wrap gap-2">
                  {[5, 10, 15, 20, 50].map(num => (
                    <button
                      key={num}
                      onClick={() => setItemsPerPage(num)}
                      className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all ${itemsPerPage === num
                        ? 'bg-secondary text-white border-secondary'
                        : 'bg-white text-foreground border-border hover:border-secondary'
                        }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Score Range */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Match Score Range ({scoreRange[0]}% - {scoreRange[1]}%)</h4>
                <div className="space-y-6 px-2">
                  <div className="relative h-2 bg-muted rounded-full">
                    <div
                      className="absolute h-full bg-[#154e24] rounded-full"
                      style={{
                        left: `${scoreRange[0]}%`,
                        right: `${100 - scoreRange[1]}%`
                      }}
                    />
                    {/* Circle Pointers */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white border-2 border-[#154e24] rounded-full shadow-md z-20 pointer-events-none"
                      style={{ left: `calc(${scoreRange[0]}% - 10px)` }}
                    />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white border-2 border-[#154e24] rounded-full shadow-md z-20 pointer-events-none"
                      style={{ left: `calc(${scoreRange[1]}% - 10px)` }}
                    />

                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={scoreRange[0]}
                      onChange={(e) => setScoreRange([Math.min(parseInt(e.target.value), scoreRange[1]), scoreRange[1]])}
                      className="absolute w-full h-full opacity-0 cursor-pointer z-30"
                    />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={scoreRange[1]}
                      onChange={(e) => setScoreRange([scoreRange[0], Math.max(parseInt(e.target.value), scoreRange[0])])}
                      className="absolute w-full h-full opacity-0 cursor-pointer z-30"
                    />
                  </div>
                  <div className="flex justify-between text-xs font-bold text-muted-foreground">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>

              {/* Status Filter */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Filter by Status</h4>
                <div className="flex flex-wrap gap-2">
                  {statusOptions.map(status => (
                    <button
                      key={status}
                      onClick={() => {
                        if (selectedStatuses.includes(status)) {
                          setSelectedStatuses(selectedStatuses.filter(s => s !== status));
                        } else {
                          setSelectedStatuses([...selectedStatuses, status]);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-1.5 ${selectedStatuses.includes(status)
                        ? 'bg-[#154e24]/10 text-[#154e24] border-[#154e24]/30'
                        : 'bg-white text-muted-foreground border-border hover:border-[#154e24]/30'
                        }`}
                    >
                      {selectedStatuses.includes(status) && <Check size={12} />}
                      {status}
                    </button>
                  ))}
                </div>
                {selectedStatuses.length > 0 && (
                  <button
                    onClick={() => setSelectedStatuses([])}
                    className="text-xs font-bold text-secondary hover:underline"
                  >
                    Clear status filters
                  </button>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-border space-y-3">
              <button
                onClick={onClose}
                disabled={!hasChanges}
                className="w-full py-3 bg-[#154e24] text-white rounded-xl font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                Apply Filters
              </button>
              <button
                onClick={handleReset}
                className="w-full py-2 text-sm font-bold text-muted-foreground hover:text-[#154e24] transition-colors"
              >
                Reset to Default
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default function App() {
  const [activeView, setActiveView] = useState<View>('advisor');
  const [preferences, setPreferences] = useState<Preferences>({});
  const [profile, setProfile] = useState<Profile>({});
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [jobText, setJobText] = useState('');
  const [currentReview, setCurrentReview] = useState<Review | null>(null);
  const [user, setUser] = useState<User | GuestUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingNotes, setUpdatingNotes] = useState(false);
  const [viewingReview, setViewingReview] = useState<Review | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [scoreRange, setScoreRange] = useState<[number, number]>([0, 100]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({ key: '', direction: null });
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'Company', 'Seniority', 'Salary/Equity', 'Score', 'Status', 'Notes', 'Date', 'Actions'
  ]);

  // Tour state
  const [runTour, setRunTour] = useState(false);
  const tourSteps: TourStep[] = [
    {
      target: 'body',
      title: 'Welcome!',
      content: 'Welcome to CareerPulse! Let us show you around.',
      placement: 'center',
    },
    {
      target: '#tour-advisor',
      title: 'Career Advisor',
      content: 'This is the Career Advisor. It is your main tool for analyzing job opportunities.',
      placement: 'right',
    },
    {
      target: '#tour-textarea',
      title: 'Instant Analysis',
      content: 'Paste any job description here to get instant AI feedback on how well it matches your profile.',
      placement: 'bottom',
    },
    {
      target: '#tour-history',
      title: 'Application History',
      content: 'All your analyzed jobs are saved here. You can track your interview progress and notes.',
      placement: 'right',
    },
    {
      target: '#tour-profile',
      title: 'My Profile',
      content: 'Upload your CV and personal details here to help the AI understand your background.',
      placement: 'right',
    },
    {
      target: '#tour-preferences',
      title: 'Settings & Preferences',
      content: 'Set your target salary, preferred working model, and tech stack here.',
      placement: 'right',
    },
  ];

  useEffect(() => {
    const hasSeenTour = localStorage.getItem('careerpulse_tour_seen');
    if (!hasSeenTour && user) {
      setRunTour(true);
    }
  }, [user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        // Check if there's a guest session
        const guestData = sessionStorage.getItem('careerpulse_guest_user');
        if (guestData) {
          setUser(JSON.parse(guestData));
        } else {
          setUser(null);
        }
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleGuestLogin = () => {
    const guestUser: GuestUser = {
      isGuest: true,
      uid: 'guest_' + Math.random().toString(36).substr(2, 9),
      email: 'Guest User'
    };
    sessionStorage.setItem('careerpulse_guest_user', JSON.stringify(guestUser));
    setUser(guestUser);
    setRunTour(true); // Automatically display onboarding wizard for guest
  };

  useEffect(() => {
    if (user) {
      fetchPreferences();
      fetchProfile();
      fetchReviews();
    } else {
      setPreferences({});
      setProfile({});
      setReviews([]);
    }
  }, [user]);

  const fetchPreferences = async () => {
    if (!user) return;

    if ('isGuest' in user) {
      const stored = localStorage.getItem(`careerpulse_prefs_${user.uid}`);
      if (stored) setPreferences(JSON.parse(stored));
      return;
    }

    if (!import.meta.env.VITE_FIREBASE_PROJECT_ID) return;
    try {
      const docRef = doc(db, 'users', user.uid, 'settings', 'preferences');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setPreferences(docSnap.data() as Preferences);
      }
    } catch (error: any) {
      console.error("Error fetching preferences:", error);
    }
  };

  const fetchProfile = async () => {
    if (!user) return;

    if ('isGuest' in user) {
      const stored = localStorage.getItem(`careerpulse_profile_${user.uid}`);
      if (stored) setProfile(JSON.parse(stored));
      return;
    }

    if (!import.meta.env.VITE_FIREBASE_PROJECT_ID) return;
    try {
      const docRef = doc(db, 'users', user.uid, 'settings', 'profile');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProfile(docSnap.data() as Profile);
      }
    } catch (error: any) {
      console.error("Error fetching profile:", error);
    }
  };

  const fetchReviews = async () => {
    if (!user) return;

    if ('isGuest' in user) {
      const stored = localStorage.getItem(`careerpulse_reviews_${user.uid}`);
      if (stored) {
        const data = JSON.parse(stored).map((review: Review) => {
          // Auto-assign "No Response" if Pending and > 2 weeks old
          if (review.status === 'Pending' && review.created_at) {
            const createdAt = new Date(review.created_at);
            const twoWeeksAgo = new Date();
            twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

            if (createdAt < twoWeeksAgo) {
              review.status = 'No Response';
            }
          }
          return review;
        });
        setReviews(data);
      }
      return;
    }

    if (!import.meta.env.VITE_FIREBASE_PROJECT_ID) return;
    try {
      const q = query(collection(db, 'users', user.uid, 'reviews'), orderBy('created_at', 'desc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => {
        const docData = doc.data();
        const review = {
          ...docData,
          id: doc.id
        } as Review;

        // Auto-assign "No Response" if Pending and > 2 weeks old
        if (review.status === 'Pending' && review.created_at) {
          const createdAt = review.created_at.seconds
            ? new Date(review.created_at.seconds * 1000)
            : new Date(review.created_at);
          const twoWeeksAgo = new Date();
          twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

          if (createdAt < twoWeeksAgo) {
            review.status = 'No Response';
          }
        }
        return review;
      });
      setReviews(data);
    } catch (error: any) {
      console.error("Error fetching reviews:", error);
    }
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      if ('isGuest' in user) {
        localStorage.setItem(`careerpulse_prefs_${user.uid}`, JSON.stringify(preferences));
        alert('Preferences saved locally!');
      } else {
        await setDoc(doc(db, 'users', user.uid, 'settings', 'preferences'), preferences);
        alert('Preferences saved to Firebase!');
      }
    } catch (error) {
      console.error("Error saving preferences:", error);
      alert('Failed to save preferences.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      if ('isGuest' in user) {
        localStorage.setItem(`careerpulse_profile_${user.uid}`, JSON.stringify(profile));
        alert('Profile saved locally!');
      } else {
        await setDoc(doc(db, 'users', user.uid, 'settings', 'profile'), profile);
        alert('Profile saved to Firebase!');
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      alert('Failed to save profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!jobText.trim()) return;
    setLoading(true);
    try {
      const result = await analyzeJobPosting(jobText, preferences, profile);
      setCurrentReview({
        ...result,
        job_description: jobText
      });
    } catch (error) {
      console.error(error);
      alert('Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setLoading(true);
      try {
        const result = await analyzeJobImage(base64, preferences, profile);
        setCurrentReview({
          ...result,
          job_description: "Image Uploaded"
        });
      } catch (error) {
        console.error(error);
        alert('Image analysis failed.');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setLoading(true);
      try {
        const result = await analyzeCV(base64, file.type);
        setProfile(prev => ({ ...prev, cv_text: result || '' }));
      } catch (error) {
        console.error(error);
        alert('CV analysis failed.');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const saveReview = async () => {
    if (!currentReview || !user) return;
    setSaving(true);
    try {
      if ('isGuest' in user) {
        const newReview = {
          ...currentReview,
          id: 'local_' + Math.random().toString(36).substr(2, 9),
          created_at: new Date().toISOString()
        };
        const updatedReviews = [newReview, ...reviews];
        localStorage.setItem(`careerpulse_reviews_${user.uid}`, JSON.stringify(updatedReviews));
        setReviews(updatedReviews);
        setCurrentReview(newReview);
        alert('Review saved locally!');
      } else {
        const docRef = await addDoc(collection(db, 'users', user.uid, 'reviews'), {
          ...currentReview,
          created_at: serverTimestamp()
        });
        setCurrentReview({ ...currentReview, id: docRef.id });
        fetchReviews();
        alert('Review saved to your history!');
      }
    } catch (error) {
      console.error("Error saving review:", error);
      alert('Failed to save review.');
    } finally {
      setSaving(false);
    }
  };

  const updateNotes = async (reviewId: string, notes: string) => {
    if (!user) return;
    setUpdatingNotes(true);
    try {
      if ('isGuest' in user) {
        const updatedReviews = reviews.map(r => r.id === reviewId ? { ...r, user_notes: notes } : r);
        localStorage.setItem(`careerpulse_reviews_${user.uid}`, JSON.stringify(updatedReviews));
        setReviews(updatedReviews);
        if (currentReview?.id === reviewId) {
          setCurrentReview({ ...currentReview, user_notes: notes });
        }
      } else {
        await setDoc(doc(db, 'users', user.uid, 'reviews', reviewId), {
          user_notes: notes
        }, { merge: true });

        if (currentReview?.id === reviewId) {
          setCurrentReview({ ...currentReview, user_notes: notes });
        }
        setReviews(reviews.map(r => r.id === reviewId ? { ...r, user_notes: notes } : r));
      }
    } catch (error) {
      console.error("Error updating notes:", error);
      alert('Failed to update notes.');
    } finally {
      setUpdatingNotes(false);
    }
  };

  const updateStatus = async (reviewId: string, status: string) => {
    if (!user) return;
    const isInterviewStatus = status.includes('Interview');
    try {
      const updateData: any = { status };
      if (isInterviewStatus) {
        updateData.had_interview = true;
      }

      if ('isGuest' in user) {
        const updatedReviews = reviews.map(r => r.id === reviewId ? { ...r, ...updateData } : r);
        localStorage.setItem(`careerpulse_reviews_${user.uid}`, JSON.stringify(updatedReviews));
        setReviews(updatedReviews);
        if (currentReview?.id === reviewId) {
          setCurrentReview({
            ...currentReview,
            ...updateData,
            had_interview: isInterviewStatus ? true : currentReview.had_interview
          });
        }
      } else {
        await setDoc(doc(db, 'users', user.uid, 'reviews', reviewId), updateData, { merge: true });

        if (currentReview?.id === reviewId) {
          setCurrentReview({
            ...currentReview,
            status,
            had_interview: isInterviewStatus ? true : currentReview.had_interview
          });
        }
        setReviews(reviews.map(r => r.id === reviewId ? {
          ...r,
          status,
          had_interview: isInterviewStatus ? true : r.had_interview
        } : r));
      }
    } catch (error) {
      console.error("Error updating status:", error);
      alert('Failed to update status.');
    }
  };

  const deleteReview = async (id: string) => {
    if (!user) return;

    const previousReviews = [...reviews];
    setReviews(reviews.filter(r => r.id !== id));
    setDeletingId(null);
    if (viewingReview?.id === id) setViewingReview(null);

    try {
      if ('isGuest' in user) {
        const updatedReviews = reviews.filter(r => r.id !== id);
        localStorage.setItem(`careerpulse_reviews_${user.uid}`, JSON.stringify(updatedReviews));
      } else {
        await deleteDoc(doc(db, 'users', user.uid, 'reviews', id));
      }
    } catch (error) {
      console.error("Error deleting review:", error);
      alert('Failed to delete review. Please check your connection.');
      setReviews(previousReviews);
    }
  };

  const handleLogout = async () => {
    try {
      if (user && 'isGuest' in user) {
        sessionStorage.removeItem('careerpulse_guest_user');
        setUser(null);
      } else {
        await signOut(auth);
      }
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-secondary" size={40} />
      </div>
    );
  }

  if (!user) {
    return <Auth onGuestLogin={handleGuestLogin} />;
  }

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' | null = 'desc';
    if (sortConfig.key === key) {
      if (sortConfig.direction === 'desc') direction = 'asc';
      else if (sortConfig.direction === 'asc') direction = null;
    }
    setSortConfig({ key, direction });
  };

  const getSortedReviews = (reviewsToSort: Review[]) => {
    if (!sortConfig.key || !sortConfig.direction) return reviewsToSort;

    return [...reviewsToSort].sort((a, b) => {
      let valA: any;
      let valB: any;

      switch (sortConfig.key) {
        case 'Company':
          valA = a.company_name?.toLowerCase() || '';
          valB = b.company_name?.toLowerCase() || '';
          break;
        case 'Seniority':
          const extractYears = (s: string) => {
            const match = s.match(/\d+/);
            return match ? parseInt(match[0]) : 0;
          };
          valA = extractYears(a.seniority_level || '');
          valB = extractYears(b.seniority_level || '');
          break;
        case 'Salary/Equity':
          const extractMaxSalary = (s: string) => {
            const matches = s.match(/\d+/g);
            if (!matches) return 0;
            return Math.max(...matches.map(m => parseInt(m)));
          };
          valA = extractMaxSalary(a.salary_info || '');
          valB = extractMaxSalary(b.salary_info || '');
          break;
        case 'Score':
          valA = a.score;
          valB = b.score;
          break;
        case 'Status':
          valA = OPTIONS.status.indexOf(a.status || 'Pending');
          valB = OPTIONS.status.indexOf(b.status || 'Pending');
          break;
        case 'Date':
          valA = a.created_at?.seconds || new Date(a.created_at).getTime() || 0;
          valB = b.created_at?.seconds || new Date(b.created_at).getTime() || 0;
          break;
        default:
          return 0;
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const filteredReviews = reviews.filter(review => {
    const matchesSearch =
      review.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      review.seniority_level?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      review.status?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'All Status' || review.status === statusFilter;

    // New filters
    const matchesMultiStatus = selectedStatuses.length === 0 || selectedStatuses.includes(review.status || 'Pending');
    const matchesScore = review.score >= scoreRange[0] && review.score <= scoreRange[1];

    return matchesSearch && matchesStatus && matchesMultiStatus && matchesScore;
  });

  const sortedReviews = getSortedReviews(filteredReviews);
  const totalPages = Math.ceil(sortedReviews.length / itemsPerPage);
  const paginatedReviews = sortedReviews.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <OnboardingTour 
        steps={tourSteps} 
        isOpen={runTour} 
        onClose={() => { 
            setRunTour(false); 
            localStorage.setItem('careerpulse_tour_seen', 'true'); 
        }} 
      />
      {/* Sidebar */}
      <nav className="w-full md:w-64 bg-white border-r border-border p-8 flex flex-col gap-1.5">
        <div className="flex items-center gap-2.5 mb-10 px-2">
          <div className="w-9 h-9 bg-secondary rounded-lg flex items-center justify-center text-white shadow-sm">
            <Briefcase size={20} />
          </div>
          <div>
            <h1 className="font-serif font-bold text-xl tracking-tight text-foreground">CareerPulse</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={`w-1.5 h-1.5 rounded-full ${import.meta.env.VITE_FIREBASE_PROJECT_ID ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {import.meta.env.VITE_FIREBASE_PROJECT_ID ? 'Cloud Sync Active' : 'Offline Mode'}
              </span>
            </div>
          </div>
        </div>

        <button
          id="tour-advisor"
          onClick={() => setActiveView('advisor')}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all border-2 ${activeView === 'advisor' ? 'bg-accent text-accent-foreground font-bold border-secondary/20 shadow-sm scale-[1.02]' : 'text-muted-foreground hover:bg-muted border-transparent'}`}
        >
          <Sparkles size={18} className={activeView === 'advisor' ? 'text-secondary' : ''} />
          Career Advisor
        </button>
        <button
          id="tour-history"
          onClick={() => setActiveView('history')}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all border-2 ${activeView === 'history' ? 'bg-accent text-accent-foreground font-bold border-secondary/20 shadow-sm scale-[1.02]' : 'text-muted-foreground hover:bg-muted border-transparent'}`}
        >
          <HistoryIcon size={18} className={activeView === 'history' ? 'text-secondary' : ''} />
          History
        </button>

        <div className="my-4 border-t border-border/50" />

        <div id="tour-personalise" className="px-4 mb-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Personalise Options</p>
        </div>

        <button
          id="tour-profile"
          onClick={() => setActiveView('profile')}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all border-2 ${activeView === 'profile' ? 'bg-accent text-accent-foreground font-bold border-secondary/20 shadow-sm scale-[1.02]' : 'text-muted-foreground hover:bg-muted border-transparent'}`}
        >
          <UserIcon size={18} className={activeView === 'profile' ? 'text-secondary' : ''} />
          My Profile
        </button>
        <button
          id="tour-preferences"
          onClick={() => setActiveView('preferences')}
          className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all border-2 ${activeView === 'preferences' ? 'bg-accent text-accent-foreground font-bold border-secondary/20 shadow-sm scale-[1.02]' : 'text-muted-foreground hover:bg-muted border-transparent'}`}
        >
          <Settings size={18} className={activeView === 'preferences' ? 'text-secondary' : ''} />
          Preferences
        </button>

        <div className="mt-auto pt-6 border-t border-border">
          <div className="px-4 py-3 mb-4 bg-muted/50 rounded-xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Logged in as</p>
            <p className="text-xs font-semibold truncate text-foreground">{user.email}</p>
          </div>
          <button
            onClick={() => setRunTour(true)}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-muted-foreground hover:bg-muted rounded-lg transition-all font-medium mb-2"
          >
            <HelpCircle size={18} />
            Help Tour
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-all font-medium"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-12 overflow-y-auto bg-background">
        <AnimatePresence mode="wait">
          {activeView === 'advisor' && (
            <motion.div
              key="advisor"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto space-y-8"
            >
              <header>
                <h2 className="text-3xl font-serif font-bold mb-2">Job Advisor</h2>
                <p className="text-muted-foreground">Paste a job description to get instant AI feedback.</p>
              </header>

              <div className="bg-white rounded-lg shadow-sm border border-border p-6 space-y-6">
                <TextareaAutosize
                  id="tour-textarea"
                  value={jobText}
                  onChange={(e) => setJobText(e.target.value)}
                  placeholder="Paste job description here..."
                  minRows={8}
                  className="w-full p-4 rounded-lg border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none font-sans text-sm"
                />

                <div className="flex flex-wrap gap-4 items-center justify-between">
                  <div className="flex gap-4">
                    <button
                      onClick={() => {
                        setJobText('');
                        setCurrentReview(null);
                      }}
                      className="flex items-center gap-2 px-4 py-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
                    >
                      Clear
                    </button>
                  </div>
                  <button
                    id="tour-analyze"
                    onClick={handleAnalyze}
                    disabled={loading || !jobText.trim()}
                    className="flex items-center gap-2 px-8 py-3 bg-secondary text-white rounded-xl font-bold hover:shadow-lg disabled:opacity-50 transition-all"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : <Sparkles size={20} />}
                    Analyze Posting
                  </button>
                </div>
              </div>

              {currentReview && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-6"
                >
                  <ReviewDetails
                    review={currentReview}
                    onUpdateNotes={(notes) => currentReview.id ? updateNotes(currentReview.id, notes) : setCurrentReview({ ...currentReview, user_notes: notes })}
                    onUpdateStatus={(status) => currentReview.id ? updateStatus(currentReview.id, status) : setCurrentReview({ ...currentReview, status: status })}
                    updatingNotes={updatingNotes}
                    isSaving={saving}
                    onSave={!currentReview.id ? saveReview : undefined}
                  />
                </motion.div>
              )}
            </motion.div>
          )}

          {activeView === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-3xl mx-auto"
            >
              <header className="mb-8">
                <h2 className="text-3xl font-serif font-bold mb-2">My Profile</h2>
                <p className="text-muted-foreground">Upload your CV and personal details to personalize your job reviews.</p>
              </header>

              <form onSubmit={handleSaveProfile} className="space-y-8">
                <section className="bg-white rounded-lg border border-border p-8 space-y-8 shadow-sm">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-wider text-black flex items-center gap-2">
                          <FileText size={14} />
                          CV / Resume Content
                        </label>
                        <label className="flex items-center gap-2 px-3 py-1.5 bg-accent/50 text-secondary rounded-lg text-xs font-bold cursor-pointer hover:bg-accent transition-all border border-secondary/20">
                          <Upload size={14} />
                          {loading ? 'Analyzing...' : 'Upload CV'}
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*,application/pdf"
                            onChange={handleCVUpload}
                            disabled={loading}
                          />
                        </label>
                      </div>
                      <TextareaAutosize
                        value={profile.cv_text || ''}
                        onChange={(e) => setProfile({ ...profile, cv_text: e.target.value })}
                        placeholder="Paste your CV text here or upload a file for the AI to analyze your experience..."
                        minRows={10}
                        className="w-full p-4 rounded-lg border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-black flex items-center gap-2">
                        <Sparkles size={14} />
                        Bio / About Me
                      </label>
                      <TextareaAutosize
                        value={profile.bio || ''}
                        onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                        placeholder="A short summary of who you are and what you're looking for..."
                        minRows={4}
                        className="w-full p-4 rounded-lg border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-black flex items-center gap-2">
                          <Briefcase size={14} />
                          Portfolio Description
                        </label>
                        <TextareaAutosize
                          value={profile.portfolio_description || ''}
                          onChange={(e) => setProfile({ ...profile, portfolio_description: e.target.value })}
                          placeholder="Describe your key projects and portfolio highlights..."
                          minRows={4}
                          className="w-full p-4 rounded-lg border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none text-sm"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-black flex items-center gap-2">
                          <LinkIcon size={14} />
                          Portfolio Link
                        </label>
                        <input
                          type="url"
                          value={profile.portfolio_link || ''}
                          onChange={(e) => setProfile({ ...profile, portfolio_link: e.target.value })}
                          placeholder="https://yourportfolio.com"
                          className="w-full p-3 rounded-lg border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </section>

                {/* Remuneration Section */}
                <section className="bg-white rounded-lg border border-border p-8 space-y-6 shadow-sm">
                  <h3 className="text-lg font-serif font-bold border-b border-border pb-2">Remuneration</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-black">Currency</label>
                      <select
                        value={profile.currency || ''}
                        onChange={(e) => setProfile({ ...profile, currency: e.target.value })}
                        className="w-full p-3 rounded-lg border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm bg-white"
                      >
                        <option value="">Select Currency</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="USD">USD ($)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="CHF">CHF (₣)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-black">Annual Salary (Gross)</label>
                      <input
                        type="text"
                        value={profile.annual_salary_gross || ''}
                        onChange={(e) => setProfile({ ...profile, annual_salary_gross: e.target.value })}
                        placeholder="e.g. 50,000"
                        className="w-full p-3 rounded-lg border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
                      />
                    </div>
                  </div>
                </section>

                {/* Benefits Section */}
                <section className="bg-white rounded-lg border border-border p-8 space-y-6 shadow-sm">
                  <h3 className="text-lg font-serif font-bold border-b border-border pb-2">Benefits</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-black">Currency</label>
                      <select
                        value={profile.benefits_currency || ''}
                        onChange={(e) => setProfile({ ...profile, benefits_currency: e.target.value })}
                        className="w-full p-3 rounded-lg border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm bg-white"
                      >
                        <option value="">Select Currency</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="USD">USD ($)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="CHF">CHF (₣)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-black">Annual Credit amount (Net)</label>
                      <input
                        type="text"
                        value={profile.annual_credit_net || ''}
                        onChange={(e) => setProfile({ ...profile, annual_credit_net: e.target.value })}
                        placeholder="e.g. 5,000"
                        className="w-full p-3 rounded-lg border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-black">Rest benefits</label>
                    <TextareaAutosize
                      value={profile.rest_benefits || ''}
                      onChange={(e) => setProfile({ ...profile, rest_benefits: e.target.value })}
                      placeholder="List other benefits like health insurance, gym, etc..."
                      minRows={3}
                      className="w-full p-4 rounded-lg border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none text-sm"
                    />
                  </div>
                </section>

                <button
                  type="submit"
                  disabled={loading}
                  style={{ backgroundColor: '#154e24' }}
                  className="w-full py-4 text-white rounded-lg font-bold hover:shadow-md transition-all flex items-center justify-center gap-2 sticky bottom-6 shadow-lg active:scale-[0.99]"
                >
                  {loading ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                  Save Profile Details
                </button>
              </form>
            </motion.div>
          )}

          {activeView === 'preferences' && (
            <motion.div
              key="preferences"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-3xl mx-auto"
            >
              <header className="mb-8">
                <h2 className="text-3xl font-serif font-bold mb-2">My Preferences</h2>
                <p className="text-muted-foreground">Build your Target Criteria Matrix to act as baseline non-negotiables.</p>
              </header>

              <form onSubmit={handleSavePreferences} className="space-y-8">
                {/* Role & Domain */}
                <section className="bg-white rounded-lg border border-border p-8 space-y-8 shadow-sm">
                  <h3 className="text-lg font-semibold flex items-center gap-3 text-foreground">
                    <Briefcase size={20} />
                    Role & Domain
                  </h3>
                  <div className="grid grid-cols-1 gap-8">
                    <AutocompleteMultiSelect
                      label="Company Type"
                      value={preferences.company_type}
                      options={OPTIONS.company_type}
                      onChange={(val) => setPreferences({ ...preferences, company_type: val })}
                    />
                    <AutocompleteMultiSelect
                      label="Domain Focus"
                      value={preferences.domain_focus}
                      options={OPTIONS.domain_focus}
                      onChange={(val) => setPreferences({ ...preferences, domain_focus: val })}
                    />
                  </div>
                </section>

                {/* Location & Model */}
                <section className="bg-white rounded-lg border border-border p-8 space-y-8 shadow-sm">
                  <h3 className="text-lg font-semibold flex items-center gap-3 text-foreground">
                    <AlertCircle size={20} />
                    Location & Model
                  </h3>
                  <div className="grid grid-cols-1 gap-8">
                    <AutocompleteMultiSelect
                      label="Local Base"
                      value={preferences.local_base}
                      options={OPTIONS.local_base}
                      onChange={(val) => setPreferences({ ...preferences, local_base: val })}
                    />
                    <AutocompleteMultiSelect
                      label="Working Model"
                      value={preferences.working_model}
                      options={OPTIONS.working_model}
                      onChange={(val) => setPreferences({ ...preferences, working_model: val })}
                    />
                  </div>
                </section>

                {/* Compensation Profile */}
                <section className="bg-white rounded-lg border border-border p-8 space-y-8 shadow-sm">
                  <h3 className="text-lg font-semibold flex items-center gap-3 text-foreground">
                    <Sparkles size={20} />
                    Compensation Profile
                  </h3>
                  <div className="grid grid-cols-1 gap-8">
                    <AutocompleteMultiSelect
                      label="Local Salary Target (Net Monthly)"
                      value={preferences.local_salary_target}
                      options={OPTIONS.local_salary_target}
                      onChange={(val) => setPreferences({ ...preferences, local_salary_target: val })}
                    />
                    <AutocompleteMultiSelect
                      label="International/Remote Target (Net Monthly)"
                      value={preferences.int_salary_target}
                      options={OPTIONS.int_salary_target}
                      onChange={(val) => setPreferences({ ...preferences, int_salary_target: val })}
                    />
                  </div>
                </section>

                {/* Work Environment */}
                <section className="bg-white rounded-lg border border-border p-8 space-y-8 shadow-sm">
                  <h3 className="text-lg font-semibold flex items-center gap-3 text-foreground">
                    <Settings size={20} />
                    Work Environment
                  </h3>
                  <div className="grid grid-cols-1 gap-8">
                    <AutocompleteMultiSelect
                      label="Tech/Design Maturity Expectations"
                      value={preferences.tech_maturity}
                      options={OPTIONS.tech_maturity}
                      onChange={(val) => setPreferences({ ...preferences, tech_maturity: val })}
                    />
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-black">Other Preferences</label>
                      <TextareaAutosize
                        value={preferences.other_preferences || ''}
                        onChange={(e) => setPreferences({ ...preferences, other_preferences: e.target.value })}
                        placeholder="e.g. Unlimited PTO, Health insurance, specific tech stack..."
                        minRows={4}
                        className="w-full p-4 rounded-lg border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none text-sm"
                      />
                    </div>
                  </div>
                </section>

                <button
                  type="submit"
                  disabled={loading}
                  style={{ backgroundColor: '#154e24' }}
                  className="w-full py-4 text-white rounded-lg font-bold hover:shadow-md transition-all flex items-center justify-center gap-2 sticky bottom-6 shadow-lg active:scale-[0.99]"
                >
                  {loading ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                  Save Target Criteria Matrix
                </button>
              </form>
            </motion.div>
          )}

          {activeView === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-6xl mx-auto space-y-8"
            >
              {/* KPI Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {[
                  {
                    label: 'Total Reviews',
                    value: reviews.length,
                    trend: ''
                  },
                  {
                    label: 'Avg Match Score',
                    value: reviews.length ? Math.round(reviews.reduce((acc, r) => acc + r.score, 0) / reviews.length) + '%' : '0%',
                    trend: ''
                  },
                  {
                    label: 'Avg Respond Rate',
                    value: reviews.length ? Math.round((reviews.filter(r => r.had_interview || (r.status && r.status.includes('Interview'))).length / reviews.length) * 100) + '%' : '0%',
                    trend: ''
                  },
                  {
                    label: 'Interview',
                    value: reviews.filter(r => r.status && r.status.includes('Interview')).length,
                    trend: reviews.length ? Math.round((reviews.filter(r => r.status && r.status.includes('Interview')).length / reviews.length) * 100) + '%' : '0%'
                  },
                  {
                    label: 'Assignment',
                    value: reviews.filter(r => r.status === 'Assignment').length,
                    trend: reviews.length ? Math.round((reviews.filter(r => r.status === 'Assignment').length / reviews.length) * 100) + '%' : '0%'
                  },
                  {
                    label: 'Pending',
                    value: reviews.filter(r => (r.status || 'Pending') === 'Pending').length,
                    trend: reviews.length ? Math.round((reviews.filter(r => (r.status || 'Pending') === 'Pending').length / reviews.length) * 100) + '%' : '0%'
                  },
                ].map((kpi, i) => (
                  <div key={i} className="bg-white p-5 rounded-2xl border border-border shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{kpi.label}</p>
                      {kpi.trend && (
                        <div className="text-sm font-bold text-[#154e24]">
                          {kpi.trend}
                        </div>
                      )}
                    </div>
                    <h3 className="text-2xl font-serif font-bold">
                      <AnimatedNumber value={kpi.value} />
                    </h3>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
                {/* Table Header Section */}
                <div className="p-6 border-b border-border space-y-6">
                  <h2 className="text-2xl font-serif font-bold">Review History</h2>

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-1 flex-col md:flex-row items-center gap-3">
                      <div className="relative w-full flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                        <input
                          type="text"
                          placeholder="Search company or role..."
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1);
                          }}
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-muted/30 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
                        />
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>

                      <div className="relative w-full md:w-48">
                        <select
                          value={statusFilter}
                          onChange={(e) => {
                            setStatusFilter(e.target.value);
                            setCurrentPage(1);
                          }}
                          className="w-full appearance-none pl-4 pr-10 py-2.5 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm font-medium cursor-pointer"
                        >
                          <option>All Status</option>
                          {OPTIONS.status.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={16} />
                      </div>
                    </div>

                    <button
                      onClick={() => setIsFilterSheetOpen(true)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-white hover:bg-muted text-sm font-bold transition-all"
                    >
                      <Filter size={16} />
                      Filters
                    </button>
                  </div>
                </div>

                <FilterSheet
                  isOpen={isFilterSheetOpen}
                  onClose={() => setIsFilterSheetOpen(false)}
                  itemsPerPage={itemsPerPage}
                  setItemsPerPage={setItemsPerPage}
                  scoreRange={scoreRange}
                  setScoreRange={setScoreRange}
                  selectedStatuses={selectedStatuses}
                  setSelectedStatuses={setSelectedStatuses}
                  visibleColumns={visibleColumns}
                  setVisibleColumns={setVisibleColumns}
                  statusOptions={OPTIONS.status}
                />

                <div className="overflow-x-auto">
                  <table className="w-full text-center">
                    <thead>
                      <tr className="bg-muted/50 text-foreground text-xs uppercase tracking-widest font-bold border-b border-border">
                        {visibleColumns.includes('Company') && (
                          <th className="px-6 py-5 cursor-pointer hover:bg-muted/80 transition-colors group" onClick={() => handleSort('Company')}>
                            <div className="flex items-center justify-center gap-1">
                              Company
                              {sortConfig.key === 'Company' && sortConfig.direction ? (
                                sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-secondary" /> : <ArrowDown size={14} className="text-secondary" />
                              ) : <ArrowUpDown size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
                            </div>
                          </th>
                        )}
                        {visibleColumns.includes('Seniority') && (
                          <th className="px-6 py-5 cursor-pointer hover:bg-muted/80 transition-colors group" onClick={() => handleSort('Seniority')}>
                            <div className="flex items-center justify-center gap-1">
                              Seniority
                              {sortConfig.key === 'Seniority' && sortConfig.direction ? (
                                sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-secondary" /> : <ArrowDown size={14} className="text-secondary" />
                              ) : <ArrowUpDown size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
                            </div>
                          </th>
                        )}
                        {visibleColumns.includes('Salary/Equity') && (
                          <th className="px-6 py-5 text-nowrap cursor-pointer hover:bg-muted/80 transition-colors group" onClick={() => handleSort('Salary/Equity')}>
                            <div className="flex items-center justify-center gap-1">
                              Salary/Equity
                              {sortConfig.key === 'Salary/Equity' && sortConfig.direction ? (
                                sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-secondary" /> : <ArrowDown size={14} className="text-secondary" />
                              ) : <ArrowUpDown size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
                            </div>
                          </th>
                        )}
                        {visibleColumns.includes('Score') && (
                          <th className="px-6 py-5 cursor-pointer hover:bg-muted/80 transition-colors group" onClick={() => handleSort('Score')}>
                            <div className="flex items-center justify-center gap-1">
                              Score
                              {sortConfig.key === 'Score' && sortConfig.direction ? (
                                sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-secondary" /> : <ArrowDown size={14} className="text-secondary" />
                              ) : <ArrowUpDown size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
                            </div>
                          </th>
                        )}
                        {visibleColumns.includes('Status') && (
                          <th className="px-6 py-5 cursor-pointer hover:bg-muted/80 transition-colors group" onClick={() => handleSort('Status')}>
                            <div className="flex items-center justify-center gap-1">
                              Status
                              {sortConfig.key === 'Status' && sortConfig.direction ? (
                                sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-secondary" /> : <ArrowDown size={14} className="text-secondary" />
                              ) : <ArrowUpDown size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
                            </div>
                          </th>
                        )}
                        {visibleColumns.includes('Notes') && <th className="px-6 py-5">Notes</th>}
                        {visibleColumns.includes('Date') && (
                          <th className="px-6 py-5 cursor-pointer hover:bg-muted/80 transition-colors group" onClick={() => handleSort('Date')}>
                            <div className="flex items-center justify-center gap-1">
                              Date
                              {sortConfig.key === 'Date' && sortConfig.direction ? (
                                sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-secondary" /> : <ArrowDown size={14} className="text-secondary" />
                              ) : <ArrowUpDown size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
                            </div>
                          </th>
                        )}
                        {visibleColumns.includes('Actions') && <th className="px-6 py-5">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {paginatedReviews.length > 0 ? paginatedReviews.map((review) => (
                        <tr key={review.id} className="hover:bg-accent/30 transition-colors group">
                          {visibleColumns.includes('Company') && <td className="px-6 py-4 text-foreground font-medium">{review.company_name}</td>}
                          {visibleColumns.includes('Seniority') && <td className="px-6 py-4 text-sm">{review.seniority_level || '-'}</td>}
                          {visibleColumns.includes('Salary/Equity') && <td className="px-6 py-4 text-sm">{review.salary_info || '-'}</td>}
                          {visibleColumns.includes('Score') && <td className="px-6 py-4 font-bold text-secondary">{review.score}%</td>}
                          {visibleColumns.includes('Status') && (
                            <td className="px-6 py-4">
                              <div className="flex justify-center">
                                <StatusDropdown
                                  value={review.status || 'Pending'}
                                  onChange={(val) => updateStatus(review.id!, val)}
                                  options={OPTIONS.status}
                                />
                              </div>
                            </td>
                          )}
                          {visibleColumns.includes('Notes') && (
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mx-auto max-w-[120px]">
                                {review.user_notes ? (
                                  <>
                                    <Plus size={12} className="text-secondary shrink-0" />
                                    <span className="truncate">{review.user_notes}</span>
                                  </>
                                ) : (
                                  <span className="text-xs text-muted-foreground/30">-</span>
                                )}
                              </div>
                            </td>
                          )}
                          {visibleColumns.includes('Date') && (
                            <td className="px-6 py-4 text-sm text-muted-foreground">
                              {review.created_at ? (
                                review.created_at.seconds
                                  ? new Date(review.created_at.seconds * 1000).toLocaleDateString()
                                  : new Date(review.created_at).toLocaleDateString()
                              ) : 'N/A'}
                            </td>
                          )}
                          {visibleColumns.includes('Actions') && (
                            <td className="px-6 py-4">
                              <div className="flex justify-center gap-2">
                                <button
                                  onClick={() => setViewingReview(review)}
                                  className="p-2 rounded-lg transition-all text-secondary hover:bg-accent"
                                  title="View Details"
                                >
                                  <Eye size={18} />
                                </button>
                                <button
                                  onClick={() => setDeletingId(review.id!)}
                                  className="p-2 hover:bg-rose-50 rounded-lg transition-colors text-rose-500"
                                  title="Delete"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={visibleColumns.length} className="px-6 py-20 text-center">
                            <div className="flex flex-col items-center gap-3 text-muted-foreground">
                              <Search size={40} className="opacity-20" />
                              <p className="font-medium">
                                {reviews.length === 0
                                  ? "No reviews yet. Start by analyzing a job posting!"
                                  : "No reviews found matching your search."}
                              </p>
                              {searchQuery && (
                                <button
                                  onClick={() => setSearchQuery('')}
                                  className="text-secondary font-bold hover:underline"
                                >
                                  Clear search
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Footer */}
                {filteredReviews.length > itemsPerPage && (
                  <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground font-medium">
                      Showing <span className="text-foreground font-bold">{paginatedReviews.length}</span> out of <span className="text-foreground font-bold">{filteredReviews.length}</span> results
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 text-xs font-bold rounded-lg border border-border bg-white hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                      >
                        Previous
                      </button>
                      <div className="flex items-center gap-1">
                        {[...Array(totalPages)].map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setCurrentPage(i + 1)}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${currentPage === i + 1 ? 'bg-secondary text-white shadow-md' : 'hover:bg-muted text-muted-foreground'}`}
                          >
                            {i + 1}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 text-xs font-bold rounded-lg border border-border bg-white hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl border border-border max-w-md w-full p-8"
            >
              <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-6">
                <Trash2 size={24} />
              </div>
              <h3 className="text-xl font-serif font-bold mb-2">Delete Review?</h3>
              <p className="text-muted-foreground mb-8">
                Are you sure you want to remove this review from your history? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeletingId(null)}
                  className="flex-1 px-4 py-3 bg-muted text-foreground font-bold rounded-xl hover:bg-muted/80 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteReview(deletingId)}
                  className="flex-1 px-4 py-3 bg-rose-500 text-white font-bold rounded-xl hover:bg-rose-600 transition-all shadow-lg shadow-rose-200"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Review Details Modal */}
      <AnimatePresence>
        {viewingReview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 40 }}
              className="bg-white rounded-3xl shadow-2xl border border-border w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-border bg-white sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-accent rounded-lg text-secondary">
                    <HistoryIcon size={20} />
                  </div>
                  <h3 className="text-xl font-serif font-bold">Review Details</h3>
                </div>
                <button
                  onClick={() => setViewingReview(null)}
                  className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                <ReviewDetails
                  review={viewingReview}
                  onUpdateNotes={(notes) => updateNotes(viewingReview.id!, notes)}
                  onUpdateStatus={(status) => updateStatus(viewingReview.id!, status)}
                  updatingNotes={updatingNotes}
                />
              </div>

              <div className="p-6 border-t border-border bg-muted/20 flex justify-end">
                <button
                  onClick={() => setViewingReview(null)}
                  className="px-8 py-3 bg-white border border-border text-foreground font-bold rounded-xl hover:bg-muted transition-all shadow-sm"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
