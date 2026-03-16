# Metallic Bonding Simulator

An interactive web-based simulator demonstrating the "sea of electrons" model of metallic bonding. This educational tool provides hands-on visualization of metallic bonding concepts including malleability, electrical conductivity, and heat conductivity.

![Metallic Bonding Simulator](https://img.shields.io/badge/React-19.0.0-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-blue) ![Vite](https://img.shields.io/badge/Vite-6.2.0-purple)

## Features

### Simulation Modes

- **Normal Mode** - View the standard "sea of electrons" model with freely moving electrons
- **Malleability Mode** - Demonstrate how metal layers can slide past each other without breaking bonds
- **Electrical Conductivity Mode** - Visualize electron flow when voltage is applied
- **Heat Conductivity Mode** - See how heat energy transfers through the metal lattice
- **Circuit Mode** - Complete an electrical circuit to understand conductivity

### Interactive Features

- **Particle Spawner** - Add custom electrons to the simulation
- **Electron Trails** - Enable visual trails to track electron movement paths
- **Crystal Structures** - Switch between square, hexagonal, and FCC lattice structures
- **Alloy Creation** - Mix different metals to create alloys
- **Animation Speed Control** - Adjust simulation speed from slow to fast
- **Temperature Control** - Modify temperature to see its effect on electron movement
- **Voltage Control** - Adjust voltage in electrical conductivity modes

### Educational Elements

- **Achievement System** - Unlock achievements by exploring features
- **Interactive Quiz** - Test knowledge with built-in quiz questions
- **Challenges** - Complete targeted challenges to reinforce learning
- **Gaze Tracking** - Crystal structure visualization mode

### Recording Features

- **GIF Export** - Record simulation as animated GIFs
- **Progress Tracking** - Visual feedback during recording

## Tech Stack

- **Frontend Framework**: React 19.0.0
- **Language**: TypeScript 5.8.2
- **Build Tool**: Vite 6.2.0
- **Styling**: Tailwind CSS 4.1.14
- **Animation**: Motion (Framer Motion)
- **Icons**: Lucide React
- **GIF Encoding**: gifenc

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd metallic-bonding-simulator
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Development

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Build

Build for production:
```bash
npm run build
```

Preview the production build:
```bash
npm run preview
```

### Linting

Run TypeScript type checking:
```bash
npm run lint
```

### Clean

Remove the dist folder:
```bash
npm run clean
```

## Project Structure

```
metallic-bonding-simulator/
├── src/
│   ├── components/
│   │   └── MetalSimulation.tsx    # Core simulation component
│   ├── App.tsx                    # Main application component
│   ├── main.tsx                   # Application entry point
│   └── index.css                  # Global styles
├── index.html                     # HTML template
├── package.json                   # Dependencies and scripts
├── vite.config.ts                 # Vite configuration
├── tsconfig.json                  # TypeScript configuration
└── README.md                      # This file
```

## Key Concepts Demonstrated

### Sea of Electrons Model

The simulator visualizes metallic bonding through the "sea of electrons" model, where:
- Metal atoms release their valence electrons into a shared pool
- These delocalized electrons move freely throughout the lattice
- Positive metal ions (cations) remain fixed in positions, creating a regular lattice structure

### Properties Explained

1. **Malleability** - The ability of metals to be hammered into thin sheets. The simulation shows how layers of atoms can slide over each other while electrons maintain the bond.

2. **Electrical Conductivity** - When voltage is applied, electrons flow through the "sea," creating an electric current. The simulator visualizes this directed electron movement.

3. **Heat Conductivity** - Thermal energy transfers through the lattice as electrons gain kinetic energy and collide with neighboring electrons and ions.

## License

This project is for educational purposes.
