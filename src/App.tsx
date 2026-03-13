import React, { useState, useEffect, useRef } from 'react';
import MetalSimulation, { SimulationMode } from './components/MetalSimulation';
import { Info, Zap, Flame, Move, Play, X, Hexagon, Download, Loader2, Trophy, Target, ChevronDown, ChevronUp, Thermometer, Zap as VoltageIcon, Plus, Eye, Sparkles, Layers, Settings, Check, Clock, Lightbulb, MousePointer, Flame as HeatIcon, Grid3X3, Gem, Star, HelpCircle } from 'lucide-react';

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

// Quiz questions
const quizQuestions: QuizQuestion[] = [
  {
    id: 'q1',
    question: 'What holds metal atoms together in the "sea of electrons" model?',
    options: ['Covalent bonds', 'Ionic bonds', 'Metallic bonds (delocalized electrons)', 'Van der Waals forces'],
    correct: 2,
    explanation: 'Metallic bonds form when positive metal ions are immersed in a "sea" of delocalized electrons that can move freely throughout the structure.'
  },
  {
    id: 'q2',
    question: 'Why are metals good conductors of electricity?',
    options: ['Their ions are stationary', 'Delocalized electrons can move freely', 'They have tightly bound electrons', 'They have no electrons'],
    correct: 1,
    explanation: 'Delocalized electrons are free to move throughout the metal, carrying charge and enabling electrical conductivity.'
  },
  {
    id: 'q3',
    question: 'What happens to a metal when it is heated?',
    options: ['Electrons slow down', 'Ions vibrate more vigorously', 'The metal becomes magnetic', 'Electrons become localized'],
    correct: 1,
    explanation: 'When heated, metal ions absorb thermal energy and vibrate more vigorously in their fixed lattice positions.'
  },
  {
    id: 'q4',
    question: 'Why can metals be hammered into sheets (malleable)?',
    options: ['Metals are brittle', 'Layers can slide past each other', 'Electrons stop moving', 'Ions repel each other'],
    correct: 1,
    explanation: 'The delocalized electrons act as a flexible "glue" that allows layers of metal ions to slide past each other without breaking the metallic bonds.'
  },
  {
    id: 'q5',
    question: 'What is the Fermi velocity?',
    options: ['Speed of sound in metals', 'Speed of delocalized electrons (~1,000,000 m/s)', 'Speed of light', 'Speed of heat'],
    correct: 1,
    explanation: 'The Fermi velocity is the extremely high speed at which delocalized electrons move in a metal, approximately 1,000,000 meters per second!'
  },
  {
    id: 'q6',
    question: 'In the circuit mode, what happens when electrons enter the wire?',
    options: ['They stop moving', 'They flow through the circuit and power the bulb', 'They disappear', 'They turn into protons'],
    correct: 1,
    explanation: 'Electrons flow through the complete circuit, passing through the light bulb filament where their kinetic energy is converted to light and heat.'
  },
];

// Default challenges
const defaultChallenges: Challenge[] = [
  { id: 'brightest', title: 'Brightest Bulb', description: 'Make the light bulb shine at maximum brightness!', target: 100, unit: '%', current: 0, completed: false, hint: 'Increase voltage in circuit mode' },
  { id: 'heat_up', title: 'Heat Wave', description: 'Heat the metal to maximum temperature', target: 100, unit: '°C', current: 0, completed: false, hint: 'Use temperature slider in heat mode' },
  { id: 'flow', title: 'Current Flow', description: 'Achieve maximum electron flow rate', target: 50, unit: 'e⁻/s', current: 0, completed: false, hint: 'Increase voltage in electrical mode' },
  { id: 'slide', title: 'Smooth Operator', description: 'Slide the atomic layers smoothly', target: 100, unit: '%', current: 0, completed: false, hint: 'Use malleability mode with auto-slide' },
];

export default function App() {
  const [mode, setMode] = useState<SimulationMode>('normal');
  const [showDiy, setShowDiy] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState<number>(0.25);
  const [autoMalleable, setAutoMalleable] = useState(false);
  
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

  // Quiz state
  const [showQuiz, setShowQuiz] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [showQuizResult, setShowQuizResult] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  // Achievement state
  const [achievements, setAchievements] = useState<Achievement[]>(defaultAchievements);
  const [showAchievements, setShowAchievements] = useState(false);
  const [newAchievement, setNewAchievement] = useState<Achievement | null>(null);

  // Challenge state
  const [showChallenges, setShowChallenges] = useState(false);
  const [challenges, setChallenges] = useState<Challenge[]>(defaultChallenges);
  const [challengeTimer, setChallengeTimer] = useState(0);

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

  // Quiz handlers
  const handleAnswerSelect = (index: number) => {
    if (showExplanation) return;
    setSelectedAnswer(index);
  };

  const handleCheckAnswer = () => {
    if (selectedAnswer === null) return;
    setShowExplanation(true);
    
    if (selectedAnswer === quizQuestions[currentQuestion].correct) {
      setQuizScore(prev => prev + 1);
      if (quizScore + 1 >= 5) {
        unlockAchievement('quiz_wizard');
      }
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestion < quizQuestions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      setShowQuizResult(true);
    }
  };

  const handleRestartQuiz = () => {
    setCurrentQuestion(0);
    setQuizScore(0);
    setShowQuizResult(false);
    setSelectedAnswer(null);
    setShowExplanation(false);
  };

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

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-blue-500/30">
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

      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center shadow-lg shadow-slate-500/20 border border-slate-500">
              <Hexagon className="w-5 h-5 text-slate-200" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Metallic Bonding Simulator</h1>
              <p className="text-xs text-slate-400 font-medium">Interactive Model of Cations & Delocalized Electrons</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Achievement Button */}
            <button
              onClick={() => setShowAchievements(true)}
              className="relative flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-sm font-medium border border-slate-700"
            >
              <Trophy className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">{unlockedCount}/{achievements.length}</span>
            </button>
            {/* Challenge Button */}
            <button
              onClick={() => setShowChallenges(true)}
              className="relative flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-sm font-medium border border-slate-700"
            >
              <Target className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Challenges</span>
              {challenges.some(c => c.completed) && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full text-[10px] flex items-center justify-center">
                  {challenges.filter(c => c.completed).length}
                </span>
              )}
            </button>
            {/* Quiz Button */}
            <button
              onClick={() => setShowQuiz(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-sm font-medium border border-slate-700"
            >
              <Star className="w-4 h-4 text-purple-400" />
              <span className="hidden sm:inline">Quiz</span>
            </button>
            {/* DIY Button */}
            <button
              onClick={() => setShowDiy(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-sm font-medium border border-slate-700"
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
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Simulation Mode</h2>
            <div className="space-y-3">
              <button
                onClick={() => setMode('normal')}
                className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all ${
                  mode === 'normal' 
                    ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' 
                    : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300'
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
                className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all ${
                  mode === 'malleable' 
                    ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' 
                    : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300'
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
                  <div className="pl-4 pr-2 py-2 flex items-center justify-between bg-slate-800/30 rounded-lg border border-slate-700/30">
                    <span className="text-sm text-slate-300">Auto-demonstrate</span>
                    <button
                      onClick={() => setAutoMalleable(!autoMalleable)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        autoMalleable ? 'bg-emerald-500' : 'bg-slate-600'
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
                  <div className="pl-4 pr-2 py-2 flex items-center justify-between bg-slate-800/30 rounded-lg border border-slate-700/30">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-300">Single Layer Mode</span>
                      <div className="group relative">
                        <HelpCircle className="w-4 h-4 text-slate-500 cursor-help" />
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 p-2 bg-slate-700 text-xs text-slate-200 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                          When enabled, only the dragged layer moves. When disabled (scientific), layers above move together.
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setSingleLayerMode(!singleLayerMode)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        singleLayerMode ? 'bg-blue-500' : 'bg-slate-600'
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
                className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all ${
                  mode === 'electrical' 
                    ? 'bg-amber-500/10 border-amber-500/50 text-amber-400' 
                    : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300'
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
                className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all ${
                  mode === 'circuit' 
                    ? 'bg-purple-500/10 border-purple-500/50 text-purple-400' 
                    : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300'
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
                className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all ${
                  mode === 'heat' 
                    ? 'bg-rose-500/10 border-rose-500/50 text-rose-400' 
                    : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300'
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
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-visible transition-all duration-300">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between p-6 hover:bg-slate-800/30 transition-colors"
            >
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Advanced Features
              </h2>
              {showAdvanced ? (
                <ChevronUp className="w-5 h-5 text-slate-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400" />
              )}
            </button>
            
            {showAdvanced && (
              <div className="px-6 pb-6 space-y-4">
                {/* Animation Speed */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-300">Animation Speed</span>
                      <div className="group relative">
                        <HelpCircle className="w-4 h-4 text-slate-500 cursor-help" />
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 p-2 bg-slate-700 text-xs text-slate-200 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                          Controls how fast delocalized electrons move. In real metals, electrons move at ~1,000,000 m/s (Fermi velocity), represented by 10x speed.
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400">{animationSpeed.toFixed(2)}x</span>
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
                  <p className="text-xs text-slate-500 mt-1">
                    Real life: ~1,000,000 m/s (10x)
                  </p>
                </div>

                {/* Temperature Control */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Thermometer className="w-4 h-4 text-rose-400" />
                      <span className="text-sm text-slate-300">Temperature</span>
                      <div className="group relative">
                        <HelpCircle className="w-4 h-4 text-slate-500 cursor-help" />
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 p-2 bg-slate-700 text-xs text-slate-200 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                          Higher temperature increases cation vibration amplitude and electron kinetic energy. This demonstrates thermal expansion and heat conduction.
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400">{temperature}°C</span>
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
                        <VoltageIcon className="w-4 h-4 text-amber-400" />
                        <span className="text-sm text-slate-300">Voltage</span>
                        <div className="group relative">
                          <HelpCircle className="w-4 h-4 text-slate-500 cursor-help" />
                          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 p-2 bg-slate-700 text-xs text-slate-200 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                            Voltage creates an electric field that applies force on electrons, causing them to drift toward the positive terminal. Higher voltage = stronger force = faster electron flow.
                          </div>
                        </div>
                      </div>
                      <span className="text-xs text-slate-400">{voltage}V</span>
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
                <div className="flex items-center justify-between py-2 border-t border-slate-700/50">
                  <div className="flex items-center gap-2">
                    <Plus className="w-4 h-4 text-blue-400" />
                    <span className="text-sm text-slate-300">Particle Spawner</span>
                    <div className="group relative">
                      <HelpCircle className="w-4 h-4 text-slate-500 cursor-help" />
                      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 p-2 bg-slate-700 text-xs text-slate-200 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
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
                      particleSpawner ? 'bg-blue-500' : 'bg-slate-600'
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
                <div className="flex items-center justify-between py-2 border-t border-slate-700/50">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-purple-400" />
                    <span className="text-sm text-slate-300">Electron Trails</span>
                    <div className="group relative">
                      <HelpCircle className="w-4 h-4 text-slate-500 cursor-help" />
                      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 p-2 bg-slate-700 text-xs text-slate-200 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
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
                      showTrails ? 'bg-purple-500' : 'bg-slate-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        showTrails ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Crystal Structure */}
                <div className="py-2 border-t border-slate-700/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Grid3X3 className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm text-slate-300">Crystal Structure</span>
                    <div className="group relative">
                      <HelpCircle className="w-4 h-4 text-slate-500 cursor-help" />
                      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 p-2 bg-slate-700 text-xs text-slate-200 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
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
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                          crystalStructure === structure
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                        } border`}
                      >
                        {structure === 'fcc' ? 'FCC' : structure.charAt(0).toUpperCase() + structure.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Alloy Creation */}
                <div className="py-2 border-t border-slate-700/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Gem className="w-4 h-4 text-amber-400" />
                    <span className="text-sm text-slate-300">Alloy Mix</span>
                    <div className="group relative">
                      <HelpCircle className="w-4 h-4 text-slate-500 cursor-help" />
                      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 p-2 bg-slate-700 text-xs text-slate-200 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
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
                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>Pure Metal A</span>
                    <span>{alloyMix}% Metal B</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Secret Mode: Export Section */}
          {secretModeEnabled && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Export</h2>
              <button
                onClick={() => setIsRecording(true)}
                disabled={isRecording}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-400 transition-colors font-medium"
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
              <p className="text-xs text-slate-500 mt-3 text-center">
                {mode === 'heat' 
                  ? "Captures the full 24-second guided tour animation." 
                  : "Captures an 8-second loop of the current simulation mode."}
              </p>
            </div>
          )}
        </div>

        {/* Main Canvas Area */}
        <div className="lg:flex-1 flex flex-col">
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-2 sm:p-6 flex-grow flex flex-col items-center justify-center relative overflow-hidden">
            <MetalSimulation 
              mode={mode} 
              isRecording={isRecording}
              animationSpeed={animationSpeed}
              autoMalleable={autoMalleable}
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
            />
            
            {/* Legend / Info Overlay */}
            <div className="mt-6 w-full max-w-[600px] flex flex-wrap gap-4 justify-center text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-red-500 border border-red-700 flex items-center justify-center">
                  <span className="text-[8px] font-bold text-white">+</span>
                </div>
                <span className="text-slate-300">Metal A Cation</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-amber-500 border border-amber-700 flex items-center justify-center">
                  <span className="text-[8px] font-bold text-white">+</span>
                </div>
                <span className="text-slate-300">Metal B (Alloy)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-400 flex items-center justify-center">
                  <span className="text-[8px] font-bold text-white">-</span>
                </div>
                <span className="text-slate-300">Delocalized Electron</span>
              </div>
            </div>
          </div>
          
          <div className="mt-6 bg-slate-800/30 border border-slate-700/50 rounded-2xl p-6">
            <h3 className="text-lg font-medium text-white mb-2">
              {mode === 'normal' && "The 'Sea of Electrons' Model"}
              {mode === 'malleable' && "Malleability & Ductility"}
              {mode === 'electrical' && "Electrical Conductivity"}
              {mode === 'circuit' && "Complete Circuit Animation"}
              {mode === 'heat' && "Thermal Conductivity"}
            </h3>
            <p className="text-slate-400 leading-relaxed">
              {mode === 'normal' && "A metal is composed of an extensive three-dimensional arrangement of positively charged ions (cations) immersed in a 'sea' of delocalized electrons. These mobile electrons can flow freely throughout the entire metallic structure, which explains why metals exhibit their characteristic physical properties."}
              {mode === 'malleable' && "The delocalized electrons function as a dynamic, flexible binding agent within the metal. When an external force is applied—such as dragging a layer of cations—the atomic layers can shift relative to one another without disrupting the metallic bonds. This sliding mechanism underlies the malleability of metals (ability to be flattened into sheets) and ductility (capacity to be stretched into wires)."}
              {mode === 'electrical' && "Applying an electrical potential difference across a metal causes the delocalized electrons to drift systematically toward the positive terminal. This directed movement of electric charge constitutes an electric current. The unrestricted mobility of electrons within the metallic lattice makes metals highly efficient conductors of electricity."}
              {mode === 'circuit' && "In a functioning electrical circuit, the battery serves as an electron pump that drives charges through the system. Electrons exit the negative terminal, travel through the connecting wire into the metal conductor, and emerge from the opposite side. As these electrons pass through the light bulb filament, their kinetic energy transforms into visible light and thermal energy before they complete the circuit by returning to the positive terminal."}
              {mode === 'heat' && "Heating a metal causes its cations to vibrate with increasing intensity. This added kinetic energy spreads through the crystal lattice through coordinated vibrations and is also carried across the metal by the rapidly moving delocalized electrons, enabling efficient thermal conduction."}
            </p>
          </div>
        </div>
        </div>
      </main>

      {/* Quiz Modal */}
      {showQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 p-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Star className="w-5 h-5 text-purple-400" />
                Quiz: Metallic Bonding
              </h2>
              <button 
                onClick={() => setShowQuiz(false)}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {showQuizResult ? (
              <div className="p-6 text-center">
                <div className="text-6xl mb-4">🎉</div>
                <h3 className="text-2xl font-bold text-white mb-2">Quiz Complete!</h3>
                <p className="text-slate-400 mb-4">
                  You scored <span className="text-emerald-400 font-bold">{quizScore}</span> out of <span className="font-bold">{quizQuestions.length}</span>
                </p>
                <p className="text-slate-500 mb-6">
                  {quizScore === quizQuestions.length 
                    ? "Perfect score! You're a metallic bonding expert! 🧙‍♂️"
                    : quizScore >= quizQuestions.length * 0.7 
                    ? "Great job! You know your stuff! 💪"
                    : "Keep learning! Practice makes perfect! 📚"}
                </p>
                <button
                  onClick={handleRestartQuiz}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-medium transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-slate-400">Question {currentQuestion + 1} of {quizQuestions.length}</span>
                  <span className="text-sm text-slate-400">Score: {quizScore}</span>
                </div>
                
                {/* Progress bar */}
                <div className="h-2 bg-slate-800 rounded-full mb-6 overflow-hidden">
                  <div 
                    className="h-full bg-purple-500 transition-all duration-300"
                    style={{ width: `${((currentQuestion + 1) / quizQuestions.length) * 100}%` }}
                  />
                </div>

                <h3 className="text-lg font-medium text-white mb-4">
                  {quizQuestions[currentQuestion].question}
                </h3>

                <div className="space-y-3 mb-6">
                  {quizQuestions[currentQuestion].options.map((option, index) => (
                    <button
                      key={index}
                      onClick={() => handleAnswerSelect(index)}
                      disabled={showExplanation}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        selectedAnswer === index
                          ? showExplanation
                            ? index === quizQuestions[currentQuestion].correct
                              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                              : 'bg-red-500/20 border-red-500 text-red-400'
                            : 'bg-purple-500/20 border-purple-500 text-purple-400'
                          : showExplanation && index === quizQuestions[currentQuestion].correct
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                          : 'bg-slate-800 border-slate-700 hover:border-slate-600 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs ${
                          selectedAnswer === index
                            ? showExplanation
                              ? index === quizQuestions[currentQuestion].correct
                                ? 'border-emerald-500 bg-emerald-500'
                                : 'border-red-500 bg-red-500'
                              : 'border-purple-500 bg-purple-500'
                            : 'border-slate-600'
                        }`}>
                          {showExplanation && index === quizQuestions[currentQuestion].correct && <Check className="w-4 h-4" />}
                          {showExplanation && selectedAnswer === index && index !== quizQuestions[currentQuestion].correct && <X className="w-4 h-4" />}
                        </span>
                        {option}
                      </div>
                    </button>
                  ))}
                </div>

                {showExplanation && (
                  <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-4">
                    <p className="text-slate-300 text-sm">
                      <span className="text-purple-400 font-medium">Explanation: </span>
                      {quizQuestions[currentQuestion].explanation}
                    </p>
                  </div>
                )}

                {!showExplanation ? (
                  <button
                    onClick={handleCheckAnswer}
                    disabled={selectedAnswer === null}
                    className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-xl font-medium transition-colors"
                  >
                    Check Answer
                  </button>
                ) : (
                  <button
                    onClick={handleNextQuestion}
                    className="w-full py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-medium transition-colors"
                  >
                    {currentQuestion < quizQuestions.length - 1 ? 'Next Question' : 'See Results'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Achievements Modal */}
      {showAchievements && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 p-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                Achievements
              </h2>
              <button 
                onClick={() => setShowAchievements(false)}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              {achievements.map((achievement) => (
                <div
                  key={achievement.id}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                    achievement.unlocked
                      ? 'bg-amber-500/10 border-amber-500/50'
                      : 'bg-slate-800/50 border-slate-700 opacity-60'
                  }`}
                >
                  <span className="text-3xl">{achievement.icon}</span>
                  <div className="flex-1">
                    <div className={`font-medium ${achievement.unlocked ? 'text-amber-400' : 'text-slate-400'}`}>
                      {achievement.name}
                    </div>
                    <div className="text-sm text-slate-500">{achievement.description}</div>
                  </div>
                  {achievement.unlocked && (
                    <Check className="w-5 h-5 text-emerald-400" />
                  )}
                </div>
              ))}
            </div>
            <div className="px-6 pb-6 text-center">
              <p className="text-slate-400 text-sm">
                {unlockedCount} of {achievements.length} achievements unlocked
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Challenges Modal */}
      {showChallenges && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 p-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Target className="w-5 h-5 text-emerald-400" />
                Challenges
              </h2>
              <button 
                onClick={() => setShowChallenges(false)}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {challenges.map((challenge) => (
                <div
                  key={challenge.id}
                  className={`p-4 rounded-xl border transition-all ${
                    challenge.completed
                      ? 'bg-emerald-500/10 border-emerald-500/50'
                      : 'bg-slate-800/50 border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-white">{challenge.title}</h3>
                      {challenge.completed && <Check className="w-4 h-4 text-emerald-400" />}
                    </div>
                    <span className="text-sm text-slate-400">
                      {challenge.current}/{challenge.target} {challenge.unit}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 mb-3">{challenge.description}</p>
                  
                  {/* Progress bar */}
                  <div className="h-2 bg-slate-800 rounded-full mb-3 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        challenge.completed ? 'bg-emerald-500' : 'bg-emerald-500/50'
                      }`}
                      style={{ width: `${(challenge.current / challenge.target) * 100}%` }}
                    />
                  </div>
                  
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Lightbulb className="w-3 h-3" />
                    Hint: {challenge.hint}
                  </p>
                </div>
              ))}
            </div>
            <div className="px-6 pb-6 text-center">
              <p className="text-slate-400 text-sm">
                {challenges.filter(c => c.completed).length} of {challenges.length} challenges completed
              </p>
            </div>
          </div>
        </div>
      )}

      {/* DIY Modal */}
      {showDiy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 p-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-400" />
                Build a Physical Model at Home
              </h2>
              <button 
                onClick={() => setShowDiy(false)}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6 text-slate-300">
              <p>You can easily build a physical version of this model using everyday household items to demonstrate metallic bonding to a class or for a science project.</p>
              
              <div>
                <h3 className="text-white font-medium mb-3">Materials Needed:</h3>
                <ul className="list-disc pl-5 space-y-2 text-slate-400">
                  <li>A clear plastic box or shallow tray (like a Tupperware container)</li>
                  <li>Large, identical spherical objects to represent <strong>cations</strong> (e.g., ping pong balls, marbles, or large beads)</li>
                  <li>Small, highly mobile objects to represent <strong>delocalized electrons</strong> (e.g., small seed beads, BB pellets, or even coarse sand)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-white font-medium mb-3">How to Build & Demonstrate:</h3>
                <ol className="list-decimal pl-5 space-y-4 text-slate-400">
                  <li>
                    <strong className="text-slate-300">Setup:</strong> Place the large balls (cations) into the clear container so they form a neat, packed layer (a lattice). Pour the small beads (electrons) over them so they fill the gaps.
                  </li>
                  <li>
                    <strong className="text-slate-300">Normal State:</strong> Gently shake the container. Notice how the large balls vibrate slightly in place, while the small beads move freely around and between them.
                  </li>
                  <li>
                    <strong className="text-slate-300">Malleability:</strong> Use a ruler or your hand to push one row of the large balls. Watch how the row slides over the adjacent row, but the small beads immediately flow into the new gaps, keeping the structure "glued" together.
                  </li>
                  <li>
                    <strong className="text-slate-300">Conductivity:</strong> Tilt the container slightly. The large balls will mostly stay in their lattice (if packed tightly), but the small beads will rapidly flow to one side, demonstrating how electrons carry a current or heat.
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/50 py-4 text-center">
        <p className="text-sm text-slate-500">author: Kirk</p>
      </footer>
    </div>
  );
}
