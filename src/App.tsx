import React, { useState, useEffect, useRef } from 'react';
import MetalSimulation, { SimulationMode } from './components/MetalSimulation';
import { useTheme } from './hooks/useTheme';
import { Info, Zap, Flame, Move, Play, X, Hexagon, Download, Loader2, Trophy, Target, ChevronDown, ChevronUp, Thermometer, Zap as VoltageIcon, Plus, Eye, Sparkles, Layers, Settings, Check, Clock, Lightbulb, MousePointer, Flame as HeatIcon, Grid3X3, Gem, Star, HelpCircle, Maximize2, Minimize2, Sun, Moon, Bell, BellOff, XCircle, AlertCircle } from 'lucide-react';

// Types
interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: number;
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  target: number;
  unit: string;
  current: number;
  completed: boolean;
  hint: string;
}

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

// Default achievements
const defaultAchievements: Achievement[] = [
  { id: 'first_try', name: 'First Steps', description: 'Start the simulation for the first time', icon: '⭐', unlocked: false },
  { id: 'layer_slider', name: 'Layer Slider', description: 'Move a layer of atoms in malleability mode', icon: '�️', unlocked: false },
  { id: 'circuit_master', name: 'Circuit Master', description: 'Complete the circuit mode', icon: '💡', unlocked: false },
  { id: 'heat_wave', name: 'Heat Wave', description: 'Watch the full heat conductivity tour', icon: '🔥', unlocked: false },
  { id: 'speed_demon', name: 'Speed Demon', description: 'Set animation speed to maximum', icon: '⚡', unlocked: false },
  { id: 'quiz_wizard', name: 'Quiz Wizard', description: 'Answer 5 quiz questions correctly', icon: '🧙', unlocked: false },
  { id: 'electron_adder', name: 'Electron Adder', description: 'Add 10 electrons using particle spawner', icon: '➕', unlocked: false },
  { id: 'alloy_maker', name: 'Alloy Maker', description: 'Create an alloy with mixed metals', icon: '🔧', unlocked: false },
  { id: 'crystal_gazer', name: 'Crystal Gazer', description: 'View all crystal structures', icon: '💎', unlocked: false },
  { id: 'trail_blazer', name: 'Trail Blazer', description: 'Enable electron trails', icon: '✨', unlocked: false },
];

// Quiz questions - organized by category
export type QuizCategory = 'basic' | 'electrical' | 'heat' | 'malleability' | 'alloys' | 'mixed';

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
  category: QuizCategory;
}

const basicQuestions: QuizQuestion[] = [
  {
    id: 'basic1',
    question: 'What holds metal atoms together in the "sea of electrons" model?',
    options: ['Covalent bonds', 'Ionic bonds', 'Metallic bonds (delocalized electrons)', 'Van der Waals forces'],
    correct: 2,
    explanation: 'Metallic bonds form when positive metal ions are immersed in a "sea" of delocalized electrons that can move freely throughout the structure.',
    category: 'basic'
  },
  {
    id: 'basic2',
    question: 'What is the charge of a metal cation in the sea of electrons model?',
    options: ['Negative', 'Neutral', 'Positive', 'Variable'],
    correct: 2,
    explanation: 'Metal atoms lose their valence electrons to become positively charged ions (cations). These cations form the lattice structure while the delocalized electrons move freely.',
    category: 'basic'
  },
  {
    id: 'basic3',
    question: 'Why are metals good conductors of electricity?',
    options: ['Their ions are stationary', 'Delocalized electrons can move freely', 'They have tightly bound electrons', 'They have no electrons'],
    correct: 1,
    explanation: 'Delocalized electrons are free to move throughout the metal, carrying charge and enabling electrical conductivity.',
    category: 'basic'
  },
  {
    id: 'basic4',
    question: 'What is the Fermi velocity?',
    options: ['Speed of sound in metals', 'Speed of delocalized electrons (~1,000,000 m/s)', 'Speed of light', 'Speed of heat'],
    correct: 1,
    explanation: 'The Fermi velocity is the extremely high speed at which delocalized electrons move in a metal, approximately 1,000,000 meters per second!',
    category: 'basic'
  },
  {
    id: 'basic5',
    question: 'Which statement best describes metallic bonding?',
    options: ['Electrons are transferred between atoms', 'Electrons are shared between two atoms', 'Electrons are shared by all atoms in the structure', 'Electrons are locked in place'],
    correct: 2,
    explanation: 'In metallic bonding, electrons are delocalized and shared by all atoms in the metal, creating a "sea" of electrons that holds the positively charged ions together.',
    category: 'basic'
  },
  {
    id: 'basic6',
    question: 'What type of structure do metal cations form?',
    options: ['Random arrangement', 'Fixed lattice/crystal structure', 'Gas-like cloud', 'Liquid arrangement'],
    correct: 1,
    explanation: 'Metal cations arrange themselves in a regular, repeating pattern called a crystal lattice or crystal structure.',
    category: 'basic'
  },
  {
    id: 'basic7',
    question: 'How many valence electrons do alkali metals have?',
    options: ['1', '2', '3', '4'],
    correct: 0,
    explanation: 'Alkali metals (Li, Na, K, etc.) have 1 valence electron in their outer shell, which they readily lose to form metallic bonds.',
    category: 'basic'
  },
  {
    id: 'basic8',
    question: 'What happens to electrons in a metal when an electric field is applied?',
    options: ['They stop moving', 'They drift in one direction', 'They vibrate in place', 'They leave the metal'],
    correct: 1,
    explanation: 'When an electric field is applied, delocalized electrons experience a force and drift in a specific direction, creating an electric current.',
    category: 'basic'
  }
];

const electricalQuestions: QuizQuestion[] = [
  {
    id: 'elec1',
    question: 'In the circuit mode, what happens when electrons enter the wire?',
    options: ['They stop moving', 'They flow through the circuit and power the bulb', 'They disappear', 'They turn into protons'],
    correct: 1,
    explanation: 'Electrons flow through the complete circuit, passing through the light bulb filament where their kinetic energy is converted to light and heat.',
    category: 'electrical'
  },
  {
    id: 'elec2',
    question: 'What happens to electrical resistance when a wire gets hotter?',
    options: ['It decreases', 'It stays the same', 'It increases', 'It becomes zero'],
    correct: 2,
    explanation: 'As temperature increases, metal ions vibrate more vigorously, making it harder for electrons to flow. This increases electrical resistance.',
    category: 'electrical'
  },
  {
    id: 'elec3',
    question: 'What does voltage represent in an electrical circuit?',
    options: ['The flow of electrons', 'The force pushing electrons', 'The resistance of wire', 'The brightness of bulb'],
    correct: 1,
    explanation: 'Voltage is the electric potential difference that creates the force pushing electrons through a circuit.',
    category: 'electrical'
  },
  {
    id: 'elec4',
    question: 'Why do metals conduct electricity better than insulators?',
    options: ['Metals have more protons', 'Metals have free electrons', 'Metals have fewer atoms', 'Metals are colder'],
    correct: 1,
    explanation: 'Metals have delocalized (free) electrons that can move easily, while insulators have tightly bound electrons.',
    category: 'electrical'
  },
  {
    id: 'elec5',
    question: 'What is the unit of electrical resistance?',
    options: ['Volt', 'Ampere', 'Ohm', 'Watt'],
    correct: 2,
    explanation: 'Ohm (Ω) is the SI unit of electrical resistance. Ohm\'s Law states R = V/I.',
    category: 'electrical'
  },
  {
    id: 'elec6',
    question: 'How does electron density affect conductivity?',
    options: ['Higher density = lower conductivity', 'Higher density = higher conductivity', 'No relationship', 'Density doesn\'t affect it'],
    correct: 1,
    explanation: 'Metals with higher electron density (more delocalized electrons per atom) generally have higher electrical conductivity.',
    category: 'electrical'
  },
  {
    id: 'elec7',
    question: 'What happens in a semiconductor at absolute zero temperature?',
    options: ['It becomes superconductor', 'It becomes conductor', 'It becomes insulator', 'It stays same'],
    correct: 2,
    explanation: 'At absolute zero, semiconductors have no thermal energy to excite electrons across the band gap, so they behave as insulators.',
    category: 'electrical'
  },
  {
    id: 'elec8',
    question: 'What is drift velocity in electrical conduction?',
    options: ['Speed of light', 'Random electron motion', 'Slow net electron flow in one direction', 'Speed of sound'],
    correct: 2,
    explanation: 'Drift velocity is the slow net movement of electrons in one direction when an electric field is applied, typically millimeters per second.',
    category: 'electrical'
  }
];

const heatQuestions: QuizQuestion[] = [
  {
    id: 'heat1',
    question: 'What happens to a metal when it is heated?',
    options: ['Electrons slow down', 'Ions vibrate more vigorously', 'The metal becomes magnetic', 'Electrons become localized'],
    correct: 1,
    explanation: 'When heated, metal ions absorb thermal energy and vibrate more vigorously in their fixed lattice positions.',
    category: 'heat'
  },
  {
    id: 'heat2',
    question: 'How does heat travel through a metal?',
    options: ['Only through ions', 'Only through electrons', 'Through vibrating ions AND moving electrons', 'Through the container'],
    correct: 2,
    explanation: 'Heat is conducted through metals by both vibrating ions (phonons) and rapidly moving delocalized electrons.',
    category: 'heat'
  },
  {
    id: 'heat3',
    question: 'Why are metals generally good thermal conductors?',
    options: ['They are shiny', 'Delocalized electrons transfer energy quickly', 'They are heavy', 'They have cold surfaces'],
    correct: 1,
    explanation: 'Fast-moving delocalized electrons can rapidly transfer kinetic energy throughout the metal structure.',
    category: 'heat'
  },
  {
    id: 'heat4',
    question: 'What is thermal conductivity a measure of?',
    options: ['How hot something is', 'How quickly heat transfers through a material', 'The temperature of an object', 'The density of a material'],
    correct: 1,
    explanation: 'Thermal conductivity measures how quickly heat energy can transfer through a material per unit area per unit time.',
    category: 'heat'
  },
  {
    id: 'heat5',
    question: 'What happens to metal cations during heat conduction?',
    options: ['They move to hotter region', 'They stay fixed but vibrate more', 'They escape the lattice', 'They become electrons'],
    correct: 1,
    explanation: 'Metal cations remain in their fixed lattice positions but gain kinetic energy and vibrate more intensely.',
    category: 'heat'
  },
  {
    id: 'heat6',
    question: 'Why does a metal feel cold to the touch?',
    options: ['It generates cold', 'It conducts heat away from your hand quickly', 'It has no heat', 'It absorbs your energy'],
    correct: 1,
    explanation: 'Metals conduct heat away from your hand very efficiently, so heat flows from your skin into the metal, making it feel cold.',
    category: 'heat'
  },
  {
    id: 'heat7',
    question: 'What is the Wiedemann-Franz law about?',
    options: ['Density relationships', 'The ratio of thermal to electrical conductivity', 'Crystal structure', 'Electron speed'],
    correct: 1,
    explanation: 'The Wiedemann-Franz law states that the ratio of thermal conductivity to electrical conductivity is proportional to temperature.',
    category: 'heat'
  },
  {
    id: 'heat8',
    question: 'How does alloying affect thermal conductivity?',
    options: ['Always increases it', 'Always decreases it', 'No effect', 'Usually decreases it'],
    correct: 3,
    explanation: 'Alloying typically introduces defects and impurities that scatter electrons and phonons, reducing thermal conductivity.',
    category: 'heat'
  }
];

const malleabilityQuestions: QuizQuestion[] = [
  {
    id: 'mal1',
    question: 'Why can metals be hammered into sheets (malleable)?',
    options: ['Metals are brittle', 'Layers can slide past each other', 'Electrons stop moving', 'Ions repel each other'],
    correct: 1,
    explanation: 'The delocalized electrons act as a flexible "glue" that allows layers of metal ions to slide past each other without breaking the metallic bonds.',
    category: 'malleability'
  },
  {
    id: 'mal2',
    question: 'What is ductility?',
    options: ['Ability to reflect light', 'Ability to be drawn into wires', 'Ability to conduct heat', 'Ability to resist bending'],
    correct: 1,
    explanation: 'Ductility is the ability of a metal to be drawn into thin wires without breaking, also due to sliding atomic layers.',
    category: 'malleability'
  },
  {
    id: 'mal3',
    question: 'What happens to metallic bonds when layers slide?',
    options: ['They break completely', 'They reform as electrons redistribute', 'They become ionic', 'They disappear'],
    correct: 1,
    explanation: 'When atomic layers slide, delocalized electrons quickly redistribute to maintain bonds between the new arrangement of ions.',
    category: 'malleability'
  },
  {
    id: 'mal4',
    question: 'Why are ceramics generally brittle while metals are malleable?',
    options: ['Ceramics have electrons', 'Ceramics have directional bonds', 'Ceramics have no delocalized electrons', 'Ceramics are cold'],
    correct: 2,
    explanation: 'Ceramics have localized electrons in directional covalent or ionic bonds. When stressed, these bonds break rather than reform.',
    category: 'malleability'
  },
  {
    id: 'mal5',
    question: 'What is slip in metallurgy?',
    options: ['Electron movement', 'Movement of atomic planes past each other', 'Heat transfer', 'Electric current'],
    correct: 1,
    explanation: 'Slip is the movement of atomic planes (layers) past each other along specific crystal planes and directions.',
    category: 'malleability'
  },
  {
    id: 'mal6',
    question: 'How does temperature affect malleability?',
    options: ['No effect', 'Higher temperature = more malleable', 'Lower temperature = more malleable', 'Temperature breaks bonds'],
    correct: 1,
    explanation: 'Higher temperatures increase atomic mobility and make it easier for layers to slide past each other, increasing malleability.',
    category: 'malleability'
  },
  {
    id: 'mal7',
    question: 'What is work hardening?',
    options: ['Heating metal to harden it', 'Making metal harder through deformation', 'Adding hardness to metals', 'Cooling metal slowly'],
    correct: 1,
    explanation: 'Work hardening (or strain hardening) occurs when a metal becomes stronger and harder through plastic deformation.',
    category: 'malleability'
  },
  {
    id: 'mal8',
    question: 'Which crystal structure is typically most malleable?',
    options: ['Body-centered cubic', 'Face-centered cubic', 'Hexagonal close-packed', 'All equally malleable'],
    correct: 1,
    explanation: 'Face-centered cubic (FCC) metals like gold, silver, and copper are typically the most malleable due to multiple slip systems.',
    category: 'malleability'
  }
];

const alloyQuestions: QuizQuestion[] = [
  {
    id: 'alloy1',
    question: 'What is an alloy?',
    options: ['A pure metal', 'A mixture of metals', 'A ceramic material', 'A polymer'],
    correct: 1,
    explanation: 'An alloy is a mixture of two or more metals, or a metal and another element, created to enhance certain properties.',
    category: 'alloys'
  },
  {
    id: 'alloy2',
    question: 'Why is steel stronger than pure iron?',
    options: ['Steel has more electrons', 'Carbon atoms fit in iron\'s lattice creating dislocations', 'Steel is lighter', 'Steel conducts better'],
    correct: 1,
    explanation: 'Small carbon atoms in steel create stress in the iron lattice, making it harder for layers to slide (stronger but less malleable).',
    category: 'alloys'
  },
  {
    id: 'alloy3',
    question: 'What does adding more metal B atoms do in an alloy simulation?',
    options: ['Makes electrons move slower', 'Changes conductivity, strength, and color', 'Has no effect', 'Makes the metal magnetic'],
    correct: 1,
    explanation: 'Alloys have different properties than pure metals - different strength, electrical/thermal conductivity, and color!',
    category: 'alloys'
  },
  {
    id: 'alloy4',
    question: 'Why is brass used for musical instruments?',
    options: ['It is magnetic', 'It has good acoustic properties and is corrosion-resistant', 'It is very soft', 'It conducts electricity'],
    correct: 1,
    explanation: 'Brass (copper + zinc) has excellent acoustic properties, is durable, and resists corrosion, making it ideal for instruments.',
    category: 'alloys'
  },
  {
    id: 'alloy5',
    question: 'What is a substitutional alloy?',
    options: ['Atoms replace each other in lattice', 'Atoms fill spaces in lattice', 'Atoms form layers', 'Atoms form chains'],
    correct: 0,
    explanation: 'In substitutional alloys, solute atoms replace some of the solvent atoms in the crystal lattice (like brass, bronze).',
    category: 'alloys'
  },
  {
    id: 'alloy6',
    question: 'What is an interstitial alloy?',
    options: ['Atoms replace each other in lattice', 'Small atoms fill spaces between lattice atoms', 'Atoms form layers', 'Atoms form chains'],
    correct: 1,
    explanation: 'In interstitial alloys, small atoms fill the spaces (interstices) between larger atoms in the lattice (like steel).',
    category: 'alloys'
  },
  {
    id: 'alloy7',
    question: 'Why is 18k gold used in jewelry rather than pure gold?',
    options: ['18k is cheaper', 'Pure gold is too soft, 18k is harder', '18k is shinier', 'Pure gold causes allergies'],
    correct: 1,
    explanation: 'Pure (24k) gold is very soft and scratches easily. Adding copper or silver creates 18k gold (75% gold) that is more durable.',
    category: 'alloys'
  },
  {
    id: 'alloy8',
    question: 'What makes stainless steel "stainless"?',
    options: ['It doesn\'t contain iron', 'Chromium forms protective oxide layer', 'It is always shiny', 'It doesn\'t conduct heat'],
    correct: 1,
    explanation: 'Chromium in stainless steel reacts with oxygen to form a thin, protective chromium oxide layer that prevents corrosion.',
    category: 'alloys'
  }
];

// Mixed questions - combines all categories
const getMixedQuestions = (): QuizQuestion[] => {
  const all = [...basicQuestions, ...electricalQuestions, ...heatQuestions, ...malleabilityQuestions, ...alloyQuestions];
  return all.sort(() => Math.random() - 0.5).slice(0, 10);
};

const quizQuestions: QuizQuestion[] = basicQuestions;

// Default challenges
const defaultChallenges: Challenge[] = [
  { id: 'brightest', title: 'Brightest Bulb', description: 'Make the light bulb shine at maximum brightness!', target: 100, unit: '%', current: 0, completed: false, hint: 'Increase voltage in circuit mode' },
  { id: 'heat_up', title: 'Heat Wave', description: 'Heat the metal to maximum temperature', target: 100, unit: '°C', current: 0, completed: false, hint: 'Use temperature slider in heat mode' },
  { id: 'flow', title: 'Current Flow', description: 'Achieve maximum electron flow rate', target: 50, unit: 'e⁻/s', current: 0, completed: false, hint: 'Increase voltage in electrical mode' },
  { id: 'slide', title: 'Smooth Operator', description: 'Slide the atomic layers smoothly', target: 100, unit: '%', current: 0, completed: false, hint: 'Use malleability mode with auto-slide' },
];

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [mode, setMode] = useState<SimulationMode>('normal');
  const [showDiy, setShowDiy] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState<number>(0.25);
  const [autoMalleable, setAutoMalleable] = useState(false);
  const [autoDemoSpeed, setAutoDemoSpeed] = useState<number>(2); // Default 2x speed for auto demonstrate
  
  // Secret mode state - enabled when user types "secret-git" on the page
  const [secretModeEnabled, setSecretModeEnabled] = useState(false);
  const typedCharsRef = useRef<string>('');
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);

  // Advanced features state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [temperature, setTemperature] = useState(0); // 0-100
  const [voltage, setVoltage] = useState(50); // 0-100
  const [showTrails, setShowTrails] = useState(false);
  const [particleSpawner, setParticleSpawner] = useState(false);
  const [crystalStructure, setCrystalStructure] = useState<'square' | 'hexagonal' | 'fcc'>('square');
  const [alloyMix, setAlloyMix] = useState(0); // 0-100 percentage
  const [singleLayerMode, setSingleLayerMode] = useState(false); // Toggle for malleability
  const [demonstrateMode, setDemonstrateMode] = useState(false); // Toggle for demonstration mode
  const [showCationElectrons, setShowCationElectrons] = useState(true); // Toggle to manually show/hide cation electrons
  const [showIllustrationNotice, setShowIllustrationNotice] = useState(true); // Collapsible illustration notice state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const simulationContainerRef = useRef<HTMLDivElement>(null);

  // Quiz state
  const [showQuiz, setShowQuiz] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [showQuizResult, setShowQuizResult] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [quizCategory, setQuizCategory] = useState<QuizCategory>('basic');
  const [selectedCategory, setSelectedCategory] = useState<QuizCategory | null>(null);
  const [activeQuizQuestions, setActiveQuizQuestions] = useState<QuizQuestion[]>([]);

  // Achievement state
  const [achievements, setAchievements] = useState<Achievement[]>(defaultAchievements);
  const [showAchievements, setShowAchievements] = useState(false);
  const [newAchievement, setNewAchievement] = useState<Achievement | null>(null);

  // Challenge state
  const [showChallenges, setShowChallenges] = useState(false);
  const [challenges, setChallenges] = useState<Challenge[]>(defaultChallenges);
  const [challengeTimer, setChallengeTimer] = useState(0);
  const [newChallenge, setNewChallenge] = useState<Challenge | null>(null);

  // Unified notification state
  const [notifications, setNotifications] = useState<{id: string; type: 'achievement' | 'challenge'; message: string; icon: string}[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [dismissedNotifications, setDismissedNotifications] = useState<Set<string>>(new Set());

  // Challenge progress updates (called from simulation)
  const [challengeProgress, setChallengeProgress] = useState({ brightest: 0, heat: 0, flow: 0, slide: 0 });

  // Track features used for achievements
  const featuresUsedRef = useRef<Set<string>>(new Set());

  // Handle typing to enable secret mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only track printable characters
      if (e.key.length === 1) {
        typedCharsRef.current += e.key;
        
        // Keep only the last 20 characters to check for the trigger
        if (typedCharsRef.current.length > 20) {
          typedCharsRef.current = typedCharsRef.current.slice(-20);
        }
        
        // Check if typed characters contain "secret-git"
        if (typedCharsRef.current.toLowerCase().includes('secret-git')) {
          setSecretModeEnabled(true);
          typedCharsRef.current = ''; // Reset after successful trigger
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Unlock achievement
  const unlockAchievement = (achievementId: string) => {
    setAchievements(prev => prev.map(achievement => {
      if (achievement.id === achievementId && !achievement.unlocked) {
        const unlocked = { ...achievement, unlocked: true, unlockedAt: Date.now() };
        setNewAchievement(unlocked);
        setTimeout(() => setNewAchievement(null), 3000);
        return unlocked;
      }
      return achievement;
    }));
  };

  // Track feature usage
  const trackFeature = (feature: string) => {
    if (!featuresUsedRef.current.has(feature)) {
      featuresUsedRef.current.add(feature);
      
      // Check and unlock relevant achievements
      if (feature === 'simulation_start') unlockAchievement('first_try');
      if (feature === 'layer_slide') unlockAchievement('layer_slider');
      if (feature === 'circuit_complete') unlockAchievement('circuit_master');
      if (feature === 'heat_tour') unlockAchievement('heat_wave');
      if (feature === 'max_speed') unlockAchievement('speed_demon');
      if (feature === 'electron_add') {
        const count = Array.from(featuresUsedRef.current).filter(f => f.startsWith('electron_')).length;
        if (count >= 10) unlockAchievement('electron_adder');
      }
      if (feature === 'alloy_create') unlockAchievement('alloy_maker');
      if (feature === 'crystal_view') unlockAchievement('crystal_gazer');
      if (feature === 'trail_enable') unlockAchievement('trail_blazer');
    }
  };

  // Quiz handlers - category based
  const getQuestionsByCategory = (category: QuizCategory): QuizQuestion[] => {
    switch (category) {
      case 'basic': return basicQuestions;
      case 'electrical': return electricalQuestions;
      case 'heat': return heatQuestions;
      case 'malleability': return malleabilityQuestions;
      case 'alloys': return alloyQuestions;
      case 'mixed': return getMixedQuestions();
      default: return basicQuestions;
    }
  };

  const startQuizWithCategory = (category: QuizCategory) => {
    setSelectedCategory(category);
    setActiveQuizQuestions(getQuestionsByCategory(category));
    setCurrentQuestion(0);
    setQuizScore(0);
    setShowQuizResult(false);
    setSelectedAnswer(null);
    setShowExplanation(false);
  };

  const handleAnswerSelect = (index: number) => {
    if (showExplanation) return;
    setSelectedAnswer(index);
  };

  const handleCheckAnswer = () => {
    if (selectedAnswer === null || activeQuizQuestions.length === 0) return;
    setShowExplanation(true);
    
    if (selectedAnswer === activeQuizQuestions[currentQuestion].correct) {
      setQuizScore(prev => prev + 1);
      if (quizScore + 1 >= 5) {
        unlockAchievement('quiz_wizard');
      }
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestion < activeQuizQuestions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      setShowQuizResult(true);
    }
  };

  const handleRestartQuiz = () => {
    if (selectedCategory) {
      startQuizWithCategory(selectedCategory);
    }
  };

  const handleBackToCategories = () => {
    setSelectedCategory(null);
    setActiveQuizQuestions([]);
    setCurrentQuestion(0);
    setQuizScore(0);
    setShowQuizResult(false);
    setSelectedAnswer(null);
    setShowExplanation(false);
  };

  // Toggle fullscreen for simulation container only
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (simulationContainerRef.current) {
        simulationContainerRef.current.requestFullscreen();
        setIsFullscreen(true);
      }
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Update challenge progress
  useEffect(() => {
    const timer = setInterval(() => {
      setChallengeTimer(prev => {
        // Update challenge progress based on current settings
        setChallenges(prev => prev.map(c => {
          let progress = 0;
          if (c.id === 'brightest' && mode === 'circuit') progress = voltage;
          if (c.id === 'heat_up' && mode === 'heat') progress = temperature;
          if (c.id === 'flow' && mode === 'electrical') progress = voltage;
          if (c.id === 'slide' && mode === 'malleable') progress = autoMalleable ? 100 : 0;
          
          const current = Math.min(progress, c.target);
          const completed = current >= c.target;
          
          return { ...c, current, completed };
        }));
        return prev + 1;
      });
    }, 500);

    return () => clearInterval(timer);
  }, [mode, voltage, temperature, autoMalleable]);

  // Challenge completion effects
  useEffect(() => {
    challenges.forEach(c => {
      if (c.completed && c.id === 'brightest') trackFeature('circuit_complete');
      if (c.completed && c.id === 'heat_up') trackFeature('heat_tour');
    });
  }, [challenges]);

  const handleRecordingComplete = (blob: Blob) => {
    setIsRecording(false);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `metal-simulation-${mode}.gif`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Check for max speed achievement
  useEffect(() => {
    if (animationSpeed >= 9.9) {
      trackFeature('max_speed');
    }
  }, [animationSpeed]);

  // Track mode changes
  useEffect(() => {
    trackFeature('simulation_start');
    if (mode === 'malleable' && autoMalleable) {
      trackFeature('layer_slide');
    }
  }, [mode, autoMalleable]);

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  const isDark = theme === 'dark';
  
  // Theme-aware classes
  const bgPrimary = isDark ? 'bg-slate-900' : 'bg-slate-50';
  const bgSecondary = isDark ? 'bg-slate-800' : 'bg-white';
  const bgTertiary = isDark ? 'bg-slate-700' : 'bg-slate-200';
  const bgCard = isDark ? 'bg-slate-800/50' : 'bg-white/80';
  const bgCardHover = isDark ? 'hover:bg-slate-700' : 'hover:bg-purple-100';
  const textPrimary = isDark ? 'text-slate-100' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-300' : 'text-slate-700';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500';
  const borderColor = isDark ? 'border-slate-700' : 'border-slate-200';
  const borderLight = isDark ? 'border-slate-800' : 'border-slate-300';
  const headerBg = isDark ? 'bg-slate-900/50' : 'bg-white/80';
  const headerBorder = isDark ? 'border-slate-800' : 'border-slate-200';
  const overlayBg = isDark ? 'bg-slate-950/80' : 'bg-slate-900/60';
  const modalBg = isDark ? 'bg-slate-900' : 'bg-white';
  const modalBorder = isDark ? 'border-slate-700' : 'border-slate-200';
  const inputBg = isDark ? 'bg-slate-800' : 'bg-slate-100';
  
  // Quiz-specific theme variables
  const quizOverlayBg = isDark ? 'bg-slate-950/80' : 'bg-slate-900/50';
  const quizCorrectBg = isDark ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-emerald-100 border-emerald-500 text-emerald-700';
  const quizIncorrectBg = isDark ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-red-100 border-red-500 text-red-700';
  const quizSelectedBg = isDark ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'bg-blue-100 border-blue-500 text-blue-700';
  const quizOptionBg = isDark ? 'bg-slate-800 border-slate-700 hover:border-slate-600 text-slate-300' : 'bg-white border-slate-300 hover:border-blue-400 text-slate-700 hover:shadow-md';
  const quizButtonBg = isDark ? 'bg-purple-600 hover:bg-purple-500' : 'bg-blue-600 hover:bg-blue-500';
  const quizSecondaryButtonBg = isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300';
  const quizProgressBg = isDark ? 'bg-slate-800' : 'bg-slate-200';
  
  return (
    <div className={`min-h-screen ${bgPrimary} ${textPrimary} font-sans selection:bg-blue-500/30 transition-colors duration-300`}>
      {/* Achievement Popup */}
      {newAchievement && (
        <div className="fixed top-20 right-4 z-50 animate-bounce">
          <div className="bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-900 px-6 py-4 rounded-xl shadow-lg flex items-center gap-3">
            <span className="text-2xl">{newAchievement.icon}</span>
            <div>
              <div className="font-bold">Achievement Unlocked!</div>
              <div className="text-sm font-medium">{newAchievement.name}</div>
            </div>
          </div>
        </div>
      )}

      <header className={`border-b ${headerBorder} ${headerBg} backdrop-blur-md sticky top-0 z-10 transition-colors duration-300`}>
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${isDark ? 'bg-gradient-to-br from-slate-600 to-slate-700' : 'bg-gradient-to-br from-violet-500 to-purple-600'} flex items-center justify-center ${isDark ? 'shadow-lg shadow-slate-500/20' : 'shadow-lg shadow-purple-500/30'} ${isDark ? 'border border-slate-500' : 'border border-purple-400'}`}>
              <Hexagon className={`w-5 h-5 ${isDark ? 'text-slate-200' : 'text-white'}`} />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Metallic Bonding Simulator</h1>
              <p className={`text-xs ${textMuted} font-medium`}>Interactive Model of Cations & Delocalized Electrons</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Theme Toggle Button - Rectangle Toggle with Sun/Moon */}
            <button
              onClick={toggleTheme}
              className={`relative flex items-center h-10 rounded-xl overflow-hidden ${bgSecondary} ${borderColor} border transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm`}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {/* Dark mode indicator (left) */}
              <div className={`flex items-center justify-center w-12 h-full transition-colors ${isDark ? 'bg-slate-700' : 'hover:bg-slate-200'}`}>
                <Moon className={`w-4 h-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`} />
              </div>
              {/* Light mode indicator (right) */}
              <div className={`flex items-center justify-center w-12 h-full transition-colors ${!isDark ? 'bg-orange-100' : 'hover:bg-slate-200'}`}>
                <Sun className="w-4 h-4 text-orange-500" />
              </div>
            </button>
            {/* Achievement Button */}
            <button
              onClick={() => setShowAchievements(true)}
              className={`relative flex items-center gap-2 px-3 py-2 rounded-lg ${bgSecondary} ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'} transition-all duration-200 hover:scale-105 active:scale-95 text-sm font-medium ${isDark ? 'border-slate-700' : 'border-slate-200'} border`}
            >
              <Trophy className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">{unlockedCount}/{achievements.length}</span>
            </button>
            {/* Challenge Button */}
            <button
              onClick={() => setShowChallenges(true)}
              className={`relative flex items-center gap-2 px-3 py-2 rounded-lg ${bgSecondary} ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'} transition-all duration-200 hover:scale-105 active:scale-95 text-sm font-medium ${isDark ? 'border-slate-700' : 'border-slate-200'} border`}
            >
              <Target className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Challenges</span>
              {challenges.some(c => c.completed) && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full text-[10px] flex items-center justify-center text-white">
                  {challenges.filter(c => c.completed).length}
                </span>
              )}
            </button>
            {/* Quiz Button */}
            <button
              onClick={() => setShowQuiz(true)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg ${bgSecondary} ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'} transition-all duration-200 hover:scale-105 active:scale-95 text-sm font-medium ${isDark ? 'border-slate-700' : 'border-slate-200'} border`}
            >
              <Star className={`w-4 h-4 ${isDark ? 'text-purple-400' : 'text-blue-600'}`} />
              <span className="hidden sm:inline">Quiz</span>
            </button>
            {/* DIY Button */}
            <button
              onClick={() => setShowDiy(true)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${bgSecondary} ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'} transition-all duration-200 hover:scale-105 active:scale-95 text-sm font-medium ${isDark ? 'border-slate-700' : 'border-slate-200'} border`}
            >
              <Info className="w-4 h-4" />
              <span className="hidden sm:inline">DIY Model</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Controls Sidebar - Fixed on desktop */}
          <div className="lg:w-80 lg:flex-shrink-0 space-y-6 lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)] lg:overflow-y-auto">
          <div className={`${bgCard} border ${borderColor}/50 rounded-2xl p-6`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-sm font-semibold ${textSecondary} uppercase tracking-wider`}>Simulation Mode</h2>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${textSecondary}`}>Demonstrate</span>
                <div className="group relative">
                  <button
                    onClick={() => setDemonstrateMode(!demonstrateMode)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      demonstrateMode ? 'bg-amber-500' : (isDark ? 'bg-slate-600' : 'bg-slate-300')
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        demonstrateMode ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <div className={`absolute right-0 top-full mt-2 w-56 p-3 ${isDark ? 'bg-slate-700' : 'bg-white'} ${isDark ? 'text-slate-200' : 'text-slate-700'} text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 ${isDark ? 'shadow-lg' : 'shadow-xl border border-slate-200'}`}>
                    Makes delocalized electrons larger and more visible for better visual demonstration.
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => setMode('normal')}
                className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-95 ${
                  mode === 'normal' 
                    ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' 
                    : `${bgSecondary} ${isDark ? 'border-slate-700' : 'border-slate-200'} ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'} ${textSecondary}`
                } border`}
              >
                <Play className="w-5 h-5" />
                <div className="text-left">
                  <div className="font-medium">Normal State</div>
                  <div className="text-xs opacity-70">Random electron movement</div>
                </div>
              </button>

              <button
                onClick={() => setMode('malleable')}
                className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-95 ${
                  mode === 'malleable' 
                    ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' 
                    : `${bgSecondary} ${isDark ? 'border-slate-700' : 'border-slate-200'} ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'} ${textSecondary}`
                } border`}
              >
                <Move className="w-5 h-5" />
                <div className="text-left">
                  <div className="font-medium">Malleability</div>
                  <div className="text-xs opacity-70">Drag layers to slide them</div>
                </div>
              </button>

              {mode === 'malleable' && (
                <div className="space-y-2">
                  <div className={`pl-4 pr-2 py-2 flex items-center justify-between ${isDark ? 'bg-slate-800/30' : 'bg-slate-100'} rounded-lg border ${isDark ? 'border-slate-700/30' : 'border-slate-200'}`}>
                    <span className={`text-sm ${textSecondary}`}>Auto-demonstrate</span>
                    <button
                      onClick={() => setAutoMalleable(!autoMalleable)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        autoMalleable ? 'bg-emerald-500' : (isDark ? 'bg-slate-600' : 'bg-slate-300')
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          autoMalleable ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  
                  {/* Single Layer Mode Toggle */}
                  <div className={`pl-4 pr-2 py-2 flex items-center justify-between ${isDark ? 'bg-slate-800/30' : 'bg-slate-100'} rounded-lg border ${isDark ? 'border-slate-700/30' : 'border-slate-200'}`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${textSecondary}`}>Single Layer Mode</span>
                      <div className="group relative">
                        <HelpCircle className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'} cursor-help`} />
                        <div className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 p-2 ${isDark ? 'bg-slate-700' : 'bg-white'} ${isDark ? 'text-slate-200' : 'text-slate-800'} text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg`}>
                          When enabled, only the dragged layer moves. When disabled (scientific), layers above move together.
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setSingleLayerMode(!singleLayerMode)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        singleLayerMode ? 'bg-blue-500' : (isDark ? 'bg-slate-600' : 'bg-slate-300')
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          singleLayerMode ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={() => setMode('electrical')}
                className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-95 ${
                  mode === 'electrical' 
                    ? 'bg-amber-500/10 border-amber-500/50 text-amber-400' 
                    : `${bgSecondary} ${isDark ? 'border-slate-700' : 'border-slate-200'} ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'} ${textSecondary}`
                } border`}
              >
                <Zap className="w-5 h-5" />
                <div className="text-left">
                  <div className="font-medium">Electrical Conductivity</div>
                  <div className="text-xs opacity-70">Apply voltage to move electrons</div>
                </div>
              </button>

              <button
                onClick={() => setMode('circuit')}
                className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-95 ${
                  mode === 'circuit' 
                    ? `${isDark ? 'bg-purple-500/10 border-purple-500/50 text-purple-400' : 'bg-blue-500/10 border-blue-500/50 text-blue-600'}` 
                    : `${bgSecondary} ${isDark ? 'border-slate-700' : 'border-slate-200'} ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'} ${textSecondary}`
                } border`}
              >
                <Zap className="w-5 h-5" />
                <div className="text-left">
                  <div className="font-medium">Complete Circuit</div>
                  <div className="text-xs opacity-70">See electrons flow through a circuit</div>
                </div>
              </button>

              <button
                onClick={() => setMode('heat')}
                className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-95 ${
                  mode === 'heat' 
                    ? 'bg-rose-500/10 border-rose-500/50 text-rose-400' 
                    : `${bgSecondary} ${isDark ? 'border-slate-700' : 'border-slate-200'} ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'} ${textSecondary}`
                } border`}
              >
                <Flame className="w-5 h-5" />
                <div className="text-left">
                  <div className="font-medium">Heat Conductivity</div>
                  <div className="text-xs opacity-70">Guided tour of heat transfer</div>
                </div>
              </button>
            </div>
          </div>

          {/* Advanced Features Dropdown */}
          <div className={`${bgCard} border ${borderColor}/50 rounded-2xl overflow-hidden transition-all duration-300 card-hover sticky top-0 z-10`}>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`w-full flex items-center justify-between p-5 ${isDark ? 'hover:bg-slate-700/70' : 'hover:bg-slate-100/80'} transition-all duration-200 rounded-t-2xl group`}
            >
              <h2 className={`text-sm font-semibold ${textSecondary} uppercase tracking-wider flex items-center gap-2`}>
                <Settings className="w-4 h-4 group-hover:text-blue-400 transition-colors" />
                Advanced Features
              </h2>
              <div className={`p-1 rounded-lg ${isDark ? 'bg-slate-700' : 'bg-slate-200'} group-hover:scale-110 transition-transform duration-200`}>
                {showAdvanced ? (
                  <ChevronUp className={`w-4 h-4 ${textMuted} transition-transform duration-300`} />
                ) : (
                  <ChevronDown className={`w-4 h-4 ${textMuted} transition-transform duration-300`} />
                )}
              </div>
            </button>
            
            {showAdvanced && (
              <div className="px-6 pb-6 space-y-4 animate-fade-in">
                {/* Animation Speed */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${textSecondary}`}>Animation Speed</span>
                      <div className="group relative">
                        <HelpCircle className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'} cursor-help`} />
                        <div className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 p-2 ${isDark ? 'bg-slate-700' : 'bg-white'} ${isDark ? 'text-slate-200' : 'text-slate-700'} text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 ${isDark ? 'shadow-lg' : 'shadow-xl border border-slate-200'}`}>
                          Controls how fast delocalized electrons move. In real metals, electrons move at ~1,000,000 m/s (Fermi velocity), represented by 10x speed.
                        </div>
                      </div>
                    </div>
                    <span className={`text-xs ${textMuted}`}>{animationSpeed.toFixed(2)}x</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.01" 
                    max="10" 
                    step="0.01"
                    value={animationSpeed} 
                    onChange={(e) => setAnimationSpeed(Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                  <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'} mt-1`}>
                    Real life: ~1,000,000 m/s (10x)
                  </p>
                </div>

                {/* Auto Demonstrate Speed */}
                {mode === 'malleable' && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Clock className={`w-4 h-4 ${isDark ? 'text-cyan-400' : 'text-cyan-500'}`} />
                        <span className={`text-sm ${textSecondary}`}>Auto Demo Speed</span>
                        <div className="group relative">
                          <HelpCircle className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'} cursor-help`} />
                          <div className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 p-2 ${isDark ? 'bg-slate-700' : 'bg-white'} ${isDark ? 'text-slate-200' : 'text-slate-700'} text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 ${isDark ? 'shadow-lg' : 'shadow-xl border border-slate-200'}`}>
                            Controls how fast the auto-demonstration animates. Adjust between 0.5x (slow) to 5x (fast).
                          </div>
                        </div>
                      </div>
                      <span className={`text-xs ${textMuted}`}>{autoDemoSpeed.toFixed(1)}x</span>
                    </div>
                    <input 
                      type="range" 
                      min="0.5" 
                      max="5" 
                      step="0.1"
                      value={autoDemoSpeed} 
                      onChange={(e) => setAutoDemoSpeed(Number(e.target.value))}
                      className="w-full accent-cyan-500"
                    />
                  </div>
                )}

                {/* Temperature Control */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Thermometer className={`w-4 h-4 ${isDark ? 'text-rose-400' : 'text-rose-500'}`} />
                      <span className={`text-sm ${textSecondary}`}>Temperature</span>
                      <div className="group relative">
                        <HelpCircle className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'} cursor-help`} />
                        <div className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 p-2 ${isDark ? 'bg-slate-700' : 'bg-white'} ${isDark ? 'text-slate-200' : 'text-slate-700'} text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 ${isDark ? 'shadow-lg' : 'shadow-xl border border-slate-200'}`}>
                          Higher temperature increases cation vibration amplitude and electron kinetic energy. This demonstrates thermal expansion and heat conduction.
                        </div>
                      </div>
                    </div>
                    <span className={`text-xs ${textMuted}`}>{temperature}°C</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    step="1"
                    value={temperature} 
                    onChange={(e) => setTemperature(Number(e.target.value))}
                    className="w-full accent-rose-500"
                  />
                </div>

                {/* Voltage Control */}
                {(mode === 'electrical' || mode === 'circuit') && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <VoltageIcon className={`w-4 h-4 ${isDark ? 'text-amber-400' : 'text-amber-500'}`} />
                        <span className={`text-sm ${textSecondary}`}>Voltage</span>
                        <div className="group relative">
                          <HelpCircle className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'} cursor-help`} />
                          <div className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 p-2 ${isDark ? 'bg-slate-700' : 'bg-white'} ${isDark ? 'text-slate-200' : 'text-slate-700'} text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 ${isDark ? 'shadow-lg' : 'shadow-xl border border-slate-200'}`}>
                            Voltage creates an electric field that applies force on electrons, causing them to drift toward the positive terminal. Higher voltage = stronger force = faster electron flow.
                          </div>
                        </div>
                      </div>
                      <span className={`text-xs ${textMuted}`}>{voltage}V</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      step="1"
                      value={voltage} 
                      onChange={(e) => setVoltage(Number(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                  </div>
                )}

                {/* Particle Spawner */}
                <div className={`flex items-center justify-between py-2 ${isDark ? 'border-t border-slate-700/50' : 'border-t border-slate-200'}`}>
                  <div className="flex items-center gap-2">
                    <Plus className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
                    <span className={`text-sm ${textSecondary}`}>Particle Spawner</span>
                    <div className="group relative">
                      <HelpCircle className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'} cursor-help`} />
                      <div className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 p-2 ${isDark ? 'bg-slate-700' : 'bg-white'} ${isDark ? 'text-slate-200' : 'text-slate-700'} text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 ${isDark ? 'shadow-lg' : 'shadow-xl border border-slate-200'}`}>
                        Enable this and click anywhere on the metal to add more delocalized electrons. Great for exploring electron density effects!
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setParticleSpawner(!particleSpawner);
                      trackFeature('particle_spawn');
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      particleSpawner ? 'bg-blue-500' : (isDark ? 'bg-slate-600' : 'bg-slate-300')
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        particleSpawner ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Electron Trails */}
                <div className={`flex items-center justify-between py-2 ${isDark ? 'border-t border-slate-700/50' : 'border-t border-slate-200'}`}>
                  <div className="flex items-center gap-2">
                    <Eye className={`w-4 h-4 ${isDark ? 'text-purple-400' : 'text-blue-600'}`} />
                    <span className={`text-sm ${textSecondary}`}>Electron Trails</span>
                    <div className="group relative">
                      <HelpCircle className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'} cursor-help`} />
                      <div className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 p-2 ${isDark ? 'bg-slate-700' : 'bg-white'} ${isDark ? 'text-slate-200' : 'text-slate-700'} text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 ${isDark ? 'shadow-lg' : 'shadow-xl border border-slate-200'}`}>
                        Visualize the paths electrons take as they move through the metal. Shows the random walk motion characteristic of thermal motion.
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowTrails(!showTrails);
                      if (!showTrails) trackFeature('trail_enable');
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      showTrails ? (isDark ? 'bg-purple-500' : 'bg-blue-500') : (isDark ? 'bg-slate-600' : 'bg-slate-300')
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        showTrails ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Show Cation Electrons Toggle - Only available in demonstrate mode */}
                {demonstrateMode && (
                <div className={`py-2 ${isDark ? 'border-t border-slate-700/50' : 'border-t border-slate-200'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className={`w-4 h-4 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
                      <span className={`text-sm ${textSecondary}`}>Cation Electrons</span>
                      <div className="group relative">
                        <HelpCircle className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'} cursor-help`} />
                        <div className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 p-2 ${isDark ? 'bg-slate-700' : 'bg-white'} ${isDark ? 'text-slate-200' : 'text-slate-700'} text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 ${isDark ? 'shadow-lg' : 'shadow-xl border border-slate-200'}`}>
                          Show inner-shell electrons inside cations. These are for illustration purposes only - in real metals, cations do not retain their electrons.
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowCationElectrons(!showCationElectrons)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        showCationElectrons ? (isDark ? 'bg-cyan-500' : 'bg-cyan-500') : (isDark ? 'bg-slate-600' : 'bg-slate-300')
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          showCationElectrons ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
                )}

                {/* Crystal Structure */}
                <div className={`py-2 ${isDark ? 'border-t border-slate-700/50' : 'border-t border-slate-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Grid3X3 className={`w-4 h-4 ${isDark ? 'text-emerald-400' : 'text-emerald-500'}`} />
                    <span className={`text-sm ${textSecondary}`}>Crystal Structure</span>
                    <div className="group relative">
                      <HelpCircle className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'} cursor-help`} />
                      <div className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 p-2 ${isDark ? 'bg-slate-700' : 'bg-white'} ${isDark ? 'text-slate-200' : 'text-slate-700'} text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 ${isDark ? 'shadow-lg' : 'shadow-xl border border-slate-200'}`}>
                        Square: Simple cubic arrangement | Hexagonal: Close-packed like magnesium | FCC: Face-centered cubic like copper - densest packing!
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {(['square', 'hexagonal', 'fcc'] as const).map((structure) => (
                      <button
                        key={structure}
                        onClick={() => {
                          setCrystalStructure(structure);
                          trackFeature('crystal_view');
                        }}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-105 active:scale-95 ${
                          crystalStructure === structure
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-500'
                            : `${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-300'} ${isDark ? 'text-slate-300' : 'text-slate-600'} ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-200'}`
                        } border`}
                      >
                        {structure === 'fcc' ? 'FCC' : structure.charAt(0).toUpperCase() + structure.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Alloy Creation */}
                <div className={`py-2 ${isDark ? 'border-t border-slate-700/50' : 'border-t border-slate-200'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Gem className={`w-4 h-4 ${isDark ? 'text-amber-400' : 'text-amber-500'}`} />
                    <span className={`text-sm ${textSecondary}`}>Alloy Mix</span>
                    <div className="group relative">
                      <HelpCircle className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'} cursor-help`} />
                      <div className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 p-2 ${isDark ? 'bg-slate-700' : 'bg-white'} ${isDark ? 'text-slate-200' : 'text-slate-800'} text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg`}>
                        Mix in Metal B atoms (gold) to create an alloy. Alloys have different properties than pure metals - they often have different strength, conductivity, and color!
                      </div>
                    </div>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    step="10"
                    value={alloyMix} 
                    onChange={(e) => {
                      setAlloyMix(Number(e.target.value));
                      if (Number(e.target.value) > 0) trackFeature('alloy_create');
                    }}
                    className="w-full accent-amber-500"
                  />
                  <div className={`flex justify-between text-xs ${textMuted} mt-1`}>
                    <span>Pure Metal A</span>
                    <span>{alloyMix}% Metal B</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Secret Mode: Export Section */}
          {secretModeEnabled && (
            <div className={`${bgCard} border ${borderColor}/50 rounded-2xl p-6 card-hover`}>
              <h2 className={`text-sm font-semibold ${textSecondary} uppercase tracking-wider mb-4`}>Export</h2>
              <button
                onClick={() => setIsRecording(true)}
                disabled={isRecording}
                className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl ${isDark ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-violet-600 hover:bg-violet-500'} ${isDark ? 'disabled:bg-slate-700 disabled:text-slate-400' : 'disabled:bg-slate-300 disabled:text-slate-500'} transition-all duration-200 hover:scale-[1.02] active:scale-95 font-medium text-white`}
              >
                {isRecording ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Recording... {Math.round(recordingProgress * 100)}%
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    {mode === 'heat' ? 'Download Full Tour GIF' : 'Download Animated GIF'}
                  </>
                )}
              </button>
              <p className={`text-xs ${textMuted} mt-3 text-center`}>
                {mode === 'heat' 
                  ? "Captures the full 24-second guided tour animation." 
                  : "Captures an 8-second loop of the current simulation mode."}
              </p>
            </div>
          )}
        </div>

        {/* Main Canvas Area - Fullscreen Wrapper */}
        <div 
          ref={simulationContainerRef}
          className={`lg:flex-1 flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-black' : ''}`}
          style={isFullscreen ? { padding: '0', backgroundColor: isDark ? '#0f172a' : '#f8fafc' } : {}}
        >
          {/* Quick Controls Bar - Animation Speed, Temperature, Electron Trails */}
          <div 
            className={`${bgCard} border ${borderColor}/50 rounded-2xl p-4 ${isFullscreen ? 'mx-2 mt-2' : ''}`}
            style={isFullscreen ? { maxWidth: '1400px', margin: '0 auto', width: 'calc(100% - 16px)' } : {}}
          >
            <div className={`flex flex-wrap items-center gap-6 ${isFullscreen ? 'gap-4' : ''}`}>
              {/* Animation Speed */}
              <div className="flex items-center gap-2 flex-1 min-w-[140px]">
                <span className={`text-xs ${textMuted} whitespace-nowrap`}>Speed</span>
                <div className="group relative">
                  <HelpCircle className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'} cursor-help`} />
                  <div className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 p-2 ${isDark ? 'bg-slate-700' : 'bg-white'} ${isDark ? 'text-slate-200' : 'text-slate-800'} text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg`}>
                    Controls how fast electrons move. Real metals: ~1,000,000 m/s!
                  </div>
                </div>
                <input 
                  type="range" 
                  min="0.01" 
                  max="10" 
                  step="0.01"
                  value={animationSpeed} 
                  onChange={(e) => setAnimationSpeed(Number(e.target.value))}
                  className="flex-1 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <span className={`text-xs ${textMuted} w-10 text-right`}>{animationSpeed.toFixed(1)}x</span>
              </div>

              {/* Temperature */}
              <div className="flex items-center gap-2 flex-1 min-w-[140px]">
                <Thermometer className={`w-4 h-4 ${isDark ? 'text-rose-400' : 'text-rose-500'}`} />
                <span className={`text-xs ${textMuted} whitespace-nowrap`}>Temp</span>
                <div className="group relative">
                  <HelpCircle className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'} cursor-help`} />
                  <div className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 p-2 ${isDark ? 'bg-slate-700' : 'bg-white'} ${isDark ? 'text-slate-200' : 'text-slate-800'} text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg`}>
                    Higher temperature = more vibration. Real metals conduct heat via electron movement!
                  </div>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  step="1"
                  value={temperature} 
                  onChange={(e) => setTemperature(Number(e.target.value))}
                  className="flex-1 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-rose-500"
                />
                <span className={`text-xs ${textMuted} w-10 text-right`}>{temperature}°C</span>
              </div>

              {/* Electron Trails Toggle */}
              <div className="flex items-center gap-2">
                <Eye className={`w-4 h-4 ${isDark ? 'text-purple-400' : 'text-blue-600'}`} />
                <span className={`text-xs ${textMuted}`}>Trails</span>
                <div className="group relative">
                  <HelpCircle className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'} cursor-help`} />
                  <div className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 p-2 ${isDark ? 'bg-slate-700' : 'bg-white'} ${isDark ? 'text-slate-200' : 'text-slate-800'} text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg`}>
                    Shows electron paths as they move randomly through the metal lattice.
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowTrails(!showTrails);
                    if (!showTrails) trackFeature('trail_enable');
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    showTrails ? (isDark ? 'bg-purple-500' : 'bg-blue-500') : (isDark ? 'bg-slate-600' : 'bg-slate-300')
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      showTrails ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Simulation Canvas */}
          <div 
            className={`${bgCard} border ${borderColor}/50 rounded-2xl p-2 sm:p-4 flex-grow flex flex-col items-center justify-center relative overflow-hidden card-hover ${isFullscreen ? '!rounded-none !border-0 mt-2' : 'mt-4'}`}
            style={isFullscreen ? { maxWidth: '1400px', margin: '0 auto', width: 'calc(100% - 16px)', minHeight: '70vh' } : {}}
          >
            {/* Fullscreen Toggle Button */}
            <button
              onClick={toggleFullscreen}
              className={`absolute top-4 right-4 z-10 p-2 rounded-lg ${bgSecondary} ${isDark ? 'border-slate-700' : 'border-slate-200'} border ${isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'} transition-all duration-200 hover:scale-110 active:scale-95`}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <div key={mode} className="animate-fade-in w-full h-full flex items-center justify-center">
              <MetalSimulation 
              mode={mode} 
              isRecording={isRecording}
              animationSpeed={animationSpeed}
              autoMalleable={autoMalleable}
              autoDemoSpeed={autoDemoSpeed}
              singleLayerMode={singleLayerMode}
              onRecordingComplete={handleRecordingComplete}
              onRecordingProgress={setRecordingProgress}
              temperature={temperature}
              voltage={voltage}
              showTrails={showTrails}
              particleSpawner={particleSpawner}
              crystalStructure={crystalStructure}
              alloyMix={alloyMix}
              onParticleSpawn={() => trackFeature('electron_add')}
              onLayerSlide={() => trackFeature('layer_slide')}
              theme={theme}
              demonstrateMode={demonstrateMode}
              showCationElectrons={showCationElectrons}
            />
            </div>
            
            {/* Legend / Info Overlay */}
            <div className={`mt-4 w-full max-w-[800px] flex flex-wrap gap-4 justify-center text-sm`}>
              <div className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded-full bg-red-500 border ${isDark ? 'border-red-700' : 'border-red-400'} flex items-center justify-center`}>
                  <span className="text-[8px] font-bold text-white">+</span>
                </div>
                <span className={textSecondary}>Metal A Cation</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded-full bg-amber-500 border ${isDark ? 'border-amber-700' : 'border-amber-400'} flex items-center justify-center`}>
                  <span className="text-[8px] font-bold text-white">+</span>
                </div>
                <span className={textSecondary}>Metal B (Alloy)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full flex items-center justify-center ${isDark ? 'bg-white border border-slate-400' : 'bg-green-500 border border-green-600'}`}>
                  <span className={`text-[8px] font-bold ${isDark ? 'text-slate-900' : 'text-white'}`}>-</span>
                </div>
                <span className={textSecondary}>Delocalized Electron*</span>
              </div>
            </div>
            
            {/* Demonstration Mode Disclaimer - Only shows when demonstrate mode is active */}
            {demonstrateMode && (
              <div className={`mt-4 w-full max-w-[800px] mx-auto px-4 py-3 ${isDark ? 'bg-amber-900/20 border-amber-700/50' : 'bg-amber-50 border-amber-200'} border rounded-xl animate-fade-in`}>
                <div 
                  className="flex items-start gap-3 cursor-pointer"
                  onClick={() => setShowIllustrationNotice(!showIllustrationNotice)}
                >
                  <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm font-medium ${isDark ? 'text-amber-200' : 'text-amber-800'}`}>
                        Illustration Note
                      </p>
                      <button className={`${isDark ? 'text-amber-400' : 'text-amber-600'} hover:opacity-80`}>
                        {showIllustrationNotice ? '▲' : '▼'}
                      </button>
                    </div>
                    {showIllustrationNotice && (
                      <div className="animate-fade-in">
                        <p className={`text-xs mt-1 ${isDark ? 'text-amber-300/80' : 'text-amber-700'}`}>
                          Delocalized electrons are shown much larger than in reality for demonstration purposes. In real metals, electrons move at ~1,000,000 m/s but are invisibly small. This visualization is simplified for educational clarity.*
                        </p>
                        <p className={`text-xs mt-2 ${isDark ? 'text-amber-300/80' : 'text-amber-700'}`}>
                          ⚠ The electrons shown inside cations are only for illustration purposes. In the sea of electrons model, metal atoms lose all valence electrons to become cations, so there are no electrons remaining inside the cations.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Description Box - Hidden in fullscreen mode */}
          {!isFullscreen && (
          <div className={`mt-6 ${bgCard} border ${borderColor}/50 rounded-2xl p-6 card-hover`}>
            <h3 className={`text-lg font-medium ${textPrimary} mb-2`}>
              {mode === 'normal' && "The 'Sea of Electrons' Model"}
              {mode === 'malleable' && "Malleability & Ductility"}
              {mode === 'electrical' && "Electrical Conductivity"}
              {mode === 'circuit' && "Complete Circuit Animation"}
              {mode === 'heat' && "Thermal Conductivity"}
            </h3>
            <p className={`${textMuted} leading-relaxed`}>
              {mode === 'normal' && "A metal is composed of an extensive three-dimensional arrangement of positively charged ions (cations) immersed in a 'sea' of delocalized electrons. These mobile electrons can flow freely throughout the entire metallic structure, which explains why metals exhibit their characteristic physical properties."}
              {mode === 'malleable' && "The delocalized electrons function as a dynamic, flexible binding agent within the metal. When an external force is applied—such as dragging a layer of cations—the atomic layers can shift relative to one another without disrupting the metallic bonds. This sliding mechanism underlies the malleability of metals (ability to be flattened into sheets) and ductility (capacity to be stretched into wires)."}
              {mode === 'electrical' && "Applying an electrical potential difference across a metal causes the delocalized electrons to drift systematically toward the positive terminal. This directed movement of electric charge constitutes an electric current. The unrestricted mobility of electrons within the metallic lattice makes metals highly efficient conductors of electricity."}
              {mode === 'circuit' && "In a functioning electrical circuit, the battery serves as an electron pump that drives charges through the system. Electrons exit the negative terminal, travel through the connecting wire into the metal conductor, and emerge from the opposite side. As these electrons pass through the light bulb filament, their kinetic energy transforms into visible light and thermal energy before they complete the circuit by returning to the positive terminal."}
              {mode === 'heat' && "Heating a metal causes its cations to vibrate with increasing intensity. This added kinetic energy spreads through the crystal lattice through coordinated vibrations and is also carried across the metal by the rapidly moving delocalized electrons, enabling efficient thermal conduction."}
            </p>
          </div>
          )}
        </div>
        </div>
      </main>

      {/* Quiz Modal - With Category Selection */}
      {showQuiz && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${quizOverlayBg} backdrop-blur-sm transition-colors duration-300`}>
          <div className={`${modalBg} border ${modalBorder} rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-fade-in`}>
            <div className={`sticky top-0 ${modalBg}/90 backdrop-blur-md border-b ${modalBorder} p-6 flex items-center justify-between`}>
              <h2 className={`text-xl font-semibold ${textPrimary} flex items-center gap-2`}>
                <Star className={`w-5 h-5 ${isDark ? 'text-purple-400' : 'text-blue-600'}`} />
                {selectedCategory ? `Quiz: ${selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)}` : 'Choose Quiz Category'}
              </h2>
              <button 
                onClick={() => { setShowQuiz(false); setSelectedCategory(null); }}
                className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'} ${textMuted} hover:${textPrimary} transition-all duration-200 hover:scale-110 active:scale-95`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Category Selection Screen */}
            {!selectedCategory ? (
              <div className="p-6">
                <p className={`${textMuted} mb-6 text-center`}>Select a category to test your knowledge!</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => startQuizWithCategory('basic')}
                    className={`p-4 rounded-xl border transition-all duration-200 hover:scale-[1.02] active:scale-95 ${isDark ? 'bg-slate-800 border-slate-700 hover:border-blue-500 hover:bg-slate-700' : 'bg-white border-slate-300 hover:border-blue-500 hover:bg-blue-50 hover:shadow-md'} text-left`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="w-4 h-4 text-blue-500" />
                      <span className={`font-medium ${textPrimary}`}>Basic Concepts</span>
                    </div>
                    <span className={`text-xs ${textMuted}`}>{basicQuestions.length} questions</span>
                  </button>
                  
                  <button
                    onClick={() => startQuizWithCategory('electrical')}
                    className={`p-4 rounded-xl border transition-all duration-200 hover:scale-[1.02] active:scale-95 ${isDark ? 'bg-slate-800 border-slate-700 hover:border-amber-500 hover:bg-slate-700' : 'bg-white border-slate-300 hover:border-amber-500 hover:bg-amber-50 hover:shadow-md'} text-left`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <span className={`font-medium ${textPrimary}`}>Electrical</span>
                    </div>
                    <span className={`text-xs ${textMuted}`}>{electricalQuestions.length} questions</span>
                  </button>
                  
                  <button
                    onClick={() => startQuizWithCategory('heat')}
                    className={`p-4 rounded-xl border transition-all duration-200 hover:scale-[1.02] active:scale-95 ${isDark ? 'bg-slate-800 border-slate-700 hover:border-rose-500 hover:bg-slate-700' : 'bg-white border-slate-300 hover:border-rose-500 hover:bg-rose-50 hover:shadow-md'} text-left`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Flame className="w-4 h-4 text-rose-500" />
                      <span className={`font-medium ${textPrimary}`}>Heat Conductivity</span>
                    </div>
                    <span className={`text-xs ${textMuted}`}>{heatQuestions.length} questions</span>
                  </button>
                  
                  <button
                    onClick={() => startQuizWithCategory('malleability')}
                    className={`p-4 rounded-xl border transition-all duration-200 hover:scale-[1.02] active:scale-95 ${isDark ? 'bg-slate-800 border-slate-700 hover:border-emerald-500 hover:bg-slate-700' : 'bg-white border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 hover:shadow-md'} text-left`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Move className="w-4 h-4 text-emerald-500" />
                      <span className={`font-medium ${textPrimary}`}>Malleability</span>
                    </div>
                    <span className={`text-xs ${textMuted}`}>{malleabilityQuestions.length} questions</span>
                  </button>
                  
                  <button
                    onClick={() => startQuizWithCategory('alloys')}
                    className={`p-4 rounded-xl border transition-all duration-200 hover:scale-[1.02] active:scale-95 ${isDark ? 'bg-slate-800 border-slate-700 hover:border-amber-500 hover:bg-slate-700' : 'bg-white border-slate-300 hover:border-amber-500 hover:bg-amber-50 hover:shadow-md'} text-left`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Gem className="w-4 h-4 text-amber-500" />
                      <span className={`font-medium ${textPrimary}`}>Alloys</span>
                    </div>
                    <span className={`text-xs ${textMuted}`}>{alloyQuestions.length} questions</span>
                  </button>
                  
                  <button
                    onClick={() => startQuizWithCategory('mixed')}
                    className={`p-4 rounded-xl border transition-all duration-200 hover:scale-[1.02] active:scale-95 ${isDark ? 'bg-slate-800 border-slate-700 hover:border-purple-500 hover:bg-slate-700' : 'bg-white border-slate-300 hover:border-purple-500 hover:bg-purple-50 hover:shadow-md'} text-left`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className={`w-4 h-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
                      <span className={`font-medium ${textPrimary}`}>Mixed Challenge</span>
                    </div>
                    <span className={`text-xs ${textMuted}`}>10 random questions</span>
                  </button>
                </div>
              </div>
            ) : showQuizResult ? (
              <div className="p-6 text-center">
                <div className="text-6xl mb-4">{quizScore === activeQuizQuestions.length ? '🏆' : quizScore >= activeQuizQuestions.length * 0.7 ? '⭐' : '💪'}</div>
                <h3 className={`text-2xl font-bold ${textPrimary} mb-2`}>Quiz Complete!</h3>
                <p className={`${textMuted} mb-4`}>
                  You scored <span className={isDark ? 'text-emerald-400' : 'text-emerald-600'} font-bold>{quizScore}</span> out of <span className="font-bold">{activeQuizQuestions.length}</span>
                </p>
                <p className={`${textMuted} mb-6`}>
                  {quizScore === activeQuizQuestions.length 
                    ? "Perfect score! You're a metallic bonding expert! 🧙‍♂️"
                    : quizScore >= activeQuizQuestions.length * 0.7 
                    ? "Great job! You know your stuff! 💪"
                    : "Keep learning! Practice makes perfect! 📚"}
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={handleBackToCategories}
                    className={`px-6 py-3 ${quizSecondaryButtonBg} rounded-xl font-medium transition-all duration-200 hover:scale-105 active:scale-95 ${textPrimary}`}
                  >
                    Other Categories
                  </button>
                  <button
                    onClick={handleRestartQuiz}
                    className={`px-6 py-3 ${quizButtonBg} rounded-xl font-medium transition-all duration-200 hover:scale-105 active:scale-95 text-white`}
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={handleBackToCategories}
                    className={`text-sm ${textMuted} hover:${textPrimary} transition-all duration-200 hover:scale-105 flex items-center gap-1`}
                  >
                    <ChevronDown className="w-4 h-4 rotate-90" />
                    Back to Categories
                  </button>
                  <span className={`text-sm ${textMuted}`}>Score: {quizScore}</span>
                </div>
                
                {/* Progress bar */}
                <div className={`h-2 ${quizProgressBg} rounded-full mb-6 overflow-hidden`}>
                  <div 
                    className="h-full bg-purple-500 transition-all duration-500 ease-out animate-pulse-subtle"
                    style={{ width: `${((currentQuestion + 1) / activeQuizQuestions.length) * 100}%` }}
                  />
                </div>

                <h3 className={`text-lg font-medium ${textPrimary} mb-4`}>
                  {activeQuizQuestions[currentQuestion].question}
                </h3>

                <div className="space-y-3 mb-6">
                  {activeQuizQuestions[currentQuestion].options.map((option, index) => (
                    <button
                      key={index}
                      onClick={() => handleAnswerSelect(index)}
                      disabled={showExplanation}
                      className={`w-full text-left p-4 rounded-xl border transition-all duration-200 hover:scale-[1.01] ${
                        selectedAnswer === index
                          ? showExplanation
                            ? index === activeQuizQuestions[currentQuestion].correct
                              ? quizCorrectBg
                              : quizIncorrectBg
                            : quizSelectedBg
                          : showExplanation && index === activeQuizQuestions[currentQuestion].correct
                          ? quizCorrectBg
                          : quizOptionBg
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs ${
                          selectedAnswer === index
                            ? showExplanation
                              ? index === activeQuizQuestions[currentQuestion].correct
                                ? isDark ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-emerald-500 bg-emerald-500 text-white'
                                : isDark ? 'border-red-500 bg-red-500 text-white' : 'border-red-500 bg-red-500 text-white'
                              : isDark ? 'border-purple-500 bg-purple-500 text-white' : 'border-blue-500 bg-blue-500 text-white'
                            : isDark ? 'border-slate-600' : 'border-slate-400'
                        }`}>
                          {showExplanation && index === activeQuizQuestions[currentQuestion].correct && <Check className="w-4 h-4" />}
                          {showExplanation && selectedAnswer === index && index !== activeQuizQuestions[currentQuestion].correct && <X className="w-4 h-4" />}
                        </span>
                        {option}
                      </div>
                    </button>
                  ))}
                </div>

                {showExplanation && (
                  <div className={`border rounded-xl p-4 mb-4 ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-blue-50 border-blue-200'}`}>
                    <p className={textSecondary}>
                      <span className={`${isDark ? 'text-purple-400' : 'text-blue-600'} font-medium`}>Explanation: </span>
                      {activeQuizQuestions[currentQuestion].explanation}
                    </p>
                  </div>
                )}

                {!showExplanation ? (
                  <button
                    onClick={handleCheckAnswer}
                    disabled={selectedAnswer === null}
                    className={`w-full py-3 ${quizButtonBg} ${isDark ? 'disabled:bg-slate-700 disabled:text-slate-500' : 'disabled:bg-slate-300 disabled:text-slate-500'} rounded-xl font-medium transition-all duration-200 hover:scale-[1.02] active:scale-95 text-white`}
                  >
                    Check Answer
                  </button>
                ) : (
                  <button
                    onClick={handleNextQuestion}
                    className={`w-full py-3 ${quizButtonBg} rounded-xl font-medium transition-all duration-200 hover:scale-[1.02] active:scale-95 text-white`}
                  >
                    {currentQuestion < activeQuizQuestions.length - 1 ? 'Next Question' : 'See Results'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Achievements Modal */}
      {showAchievements && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${overlayBg} backdrop-blur-sm transition-colors duration-300`}>
          <div className={`${modalBg} border ${modalBorder} rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-fade-in`}>
            <div className={`sticky top-0 ${modalBg}/90 backdrop-blur-md border-b ${modalBorder} p-6 flex items-center justify-between`}>
              <h2 className={`text-xl font-semibold ${textPrimary} flex items-center gap-2`}>
                <Trophy className="w-5 h-5 text-amber-400" />
                Achievements
              </h2>
              <button 
                onClick={() => setShowAchievements(false)}
                className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'} ${textMuted} hover:${textPrimary} transition-all duration-200 hover:scale-110 active:scale-95`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              {achievements.map((achievement) => (
                <div
                  key={achievement.id}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 ${
                    achievement.unlocked
                      ? 'bg-amber-500/10 border-amber-500/50'
                      : `${bgCard} border-slate-700 opacity-60`
                  }`}
                >
                  <span className="text-3xl">{achievement.icon}</span>
                  <div className="flex-1">
                    <div className={`font-medium ${achievement.unlocked ? 'text-amber-400' : textMuted}`}>
                      {achievement.name}
                    </div>
                    <div className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{achievement.description}</div>
                  </div>
                  {achievement.unlocked && (
                    <Check className="w-5 h-5 text-emerald-400" />
                  )}
                </div>
              ))}
            </div>
            <div className="px-6 pb-6 text-center">
              <p className={`${textMuted} text-sm`}>
                {unlockedCount} of {achievements.length} achievements unlocked
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Challenges Modal */}
      {showChallenges && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${overlayBg} backdrop-blur-sm transition-colors duration-300`}>
          <div className={`${modalBg} border ${modalBorder} rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-fade-in`}>
            <div className={`sticky top-0 ${modalBg}/90 backdrop-blur-md border-b ${modalBorder} p-6 flex items-center justify-between`}>
              <h2 className={`text-xl font-semibold ${textPrimary} flex items-center gap-2`}>
                <Target className="w-5 h-5 text-emerald-400" />
                Challenges
              </h2>
              <button 
                onClick={() => setShowChallenges(false)}
                className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'} ${textMuted} hover:${textPrimary} transition-all duration-200 hover:scale-110 active:scale-95`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {challenges.map((challenge) => (
                <div
                  key={challenge.id}
                  className={`p-4 rounded-xl border transition-all duration-300 ${
                    challenge.completed
                      ? 'bg-emerald-500/10 border-emerald-500/50'
                      : `${bgCard} border-slate-700`
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className={`font-medium ${textPrimary}`}>{challenge.title}</h3>
                      {challenge.completed && <Check className="w-4 h-4 text-emerald-400" />}
                    </div>
                    <span className={`text-sm ${textMuted}`}>
                      {challenge.current}/{challenge.target} {challenge.unit}
                    </span>
                  </div>
                  <p className={`text-sm ${textMuted} mb-3`}>{challenge.description}</p>
                  
                  {/* Progress bar */}
                  <div className={`h-2 ${isDark ? 'bg-slate-800' : 'bg-slate-200'} rounded-full mb-3 overflow-hidden`}>
                    <div 
                      className={`h-full transition-all duration-700 ease-out ${challenge.completed ? 'bg-emerald-500' : 'bg-emerald-500/50'}`}
                      style={{ width: `${(challenge.current / challenge.target) * 100}%` }}
                    />
                  </div>
                  
                  <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'} flex items-center gap-1`}>
                    <Lightbulb className="w-3 h-3" />
                    Hint: {challenge.hint}
                  </p>
                </div>
              ))}
            </div>
            <div className="px-6 pb-6 text-center">
              <p className={`${textMuted} text-sm`}>
                {challenges.filter(c => c.completed).length} of {challenges.length} challenges completed
              </p>
            </div>
          </div>
        </div>
      )}

      {/* DIY Modal */}
      {showDiy && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${overlayBg} backdrop-blur-sm transition-colors duration-300`}>
          <div className={`${modalBg} border ${modalBorder} rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-fade-in`}>
            <div className={`sticky top-0 ${modalBg}/90 backdrop-blur-md border-b ${modalBorder} p-6 flex items-center justify-between`}>
              <h2 className={`text-xl font-semibold ${textPrimary} flex items-center gap-2`}>
                <Info className="w-5 h-5 text-blue-400" />
                Build a Physical Model at Home
              </h2>
              <button 
                onClick={() => setShowDiy(false)}
                className={`p-2 rounded-lg ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'} ${textMuted} hover:${textPrimary} transition-all duration-200 hover:scale-110 active:scale-95`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className={`p-6 space-y-6 ${textSecondary}`}>
              <p>You can easily build a physical version of this model using everyday household items to demonstrate metallic bonding to a class or for a science project.</p>
              
              <div>
                <h3 className={`${textPrimary} font-medium mb-3`}>Materials Needed:</h3>
                <ul className={`list-disc pl-5 space-y-2 ${textMuted}`}>
                  <li>A clear plastic box or shallow tray (like a Tupperware container)</li>
                  <li>Large, identical spherical objects to represent <strong className={textSecondary}>cations</strong> (e.g., ping pong balls, marbles, or large beads)</li>
                  <li>Small, highly mobile objects to represent <strong className={textSecondary}>delocalized electrons</strong> (e.g., small seed beads, BB pellets, or even coarse sand)</li>
                  <li>Optional: Different colored balls to represent alloy atoms</li>
                  <li>Optional: A small fan or hairdryer (for demonstrating conductivity)</li>
                </ul>
              </div>

              <div>
                <h3 className={`${textPrimary} font-medium mb-3`}>Step-by-Step Instructions:</h3>
                <ol className={`list-decimal pl-5 space-y-4 ${textMuted}`}>
                  <li>
                    <strong className={textSecondary}>Prepare the Container:</strong> Clean and dry your clear plastic container. A rectangular shape works best for demonstrating conductivity.
                  </li>
                  <li>
                    <strong className={textSecondary}>Create the Lattice:</strong> Place the large balls (cations) into the container. Try to arrange them in a neat, packed layer. This represents the crystal lattice structure of a metal. For a more realistic model, use multiple layers.
                  </li>
                  <li>
                    <strong className={textSecondary}>Add Electrons:</strong> Pour the small beads (electrons) over the cations. They should fill the gaps between the larger balls, representing the "sea of electrons."
                  </li>
                  <li>
                    <strong className={textSecondary}>Demonstrate Normal State:</strong> Gently shake the container. Notice how the large balls vibrate slightly in place (representing thermal vibration), while the small beads move freely around and between them. This demonstrates the mobile nature of delocalized electrons.
                  </li>
                  <li>
                    <strong className={textSecondary}>Demonstrate Malleability:</strong> Use a ruler or your finger to push one row of the large balls. Watch how the row slides over the adjacent row. Notice how the small beads immediately flow into the new gaps, keeping the structure "glued" together. This demonstrates why metals are malleable and ductile!
                  </li>
                  <li>
                    <strong className={textSecondary}>Demonstrate Electrical Conductivity:</strong> Tilt the container slightly. The large balls will mostly stay in their lattice positions (if packed tightly), but the small beads will rapidly flow to one side. This demonstrates how electrons can carry electrical current when a voltage is applied.
                  </li>
                  <li>
                    <strong className={textSecondary}>Demonstrate Thermal Conductivity (Advanced):</strong> Use a small fan or hairdryer to blow on one corner of your model. The small beads near the heat source will move faster and eventually transfer energy throughout the container - just like heat conduction in metals!
                  </li>
                  <li>
                    <strong className={textSecondary}>Create an Alloy:</strong> Add a few differently colored balls (representing Metal B atoms) to your lattice. Mix them in and observe how the structure still holds together. This demonstrates how alloys work!
                  </li>
                </ol>
              </div>

              <div>
                <h3 className={`${textPrimary} font-medium mb-3`}>Tips for Success:</h3>
                <ul className={`list-disc pl-5 space-y-2 ${textMuted}`}>
                  <li>Use ping pong balls for cations - they're lightweight and easy to work with</li>
                  <li>Small beads (like craft beads or sand) work well for electrons</li>
                  <li>Make sure your container is level for the best demonstration</li>
                  <li>Use differently colored balls for Metal A and Metal B to clearly show alloys</li>
                  <li>Practice the demonstrations a few times before presenting</li>
                </ul>
              </div>

              <div className={`p-4 rounded-xl ${isDark ? 'bg-blue-900/30 border border-blue-800' : 'bg-blue-50 border border-blue-200'}`}>
                <h4 className={`font-medium ${textPrimary} mb-2`}>🔬 Science Connection</h4>
                <p className={`text-sm ${textMuted}`}>
                  This physical model demonstrates key concepts of the "sea of electrons" model: (1) positive ions in a lattice, (2) mobile electrons that can flow, (3) how electrons act as a "glue" allowing layers to slide, and (4) how electrons can transfer both charge (electricity) and energy (heat) through the metal.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className={`border-t ${headerBorder} ${headerBg} py-4 text-center transition-colors duration-300`}>
        <p className={`text-sm ${textMuted}`}>author: Kirk</p>
      </footer>
    </div>
  );
}
