# Chat App

A modern, responsive chat application built with React, TypeScript, and Tailwind CSS.

## Features

- 🎨 **Modern UI/UX**: Clean, responsive design with smooth animations
- 🌓 **Theme Support**: Light, dark, and system theme options
- 📱 **Mobile Responsive**: Optimized for both desktop and mobile devices
- ♿ **Accessible**: Full keyboard navigation and screen reader support
- 💬 **Rich Interactions**: Message hover actions, context menus, and more
- ⚙️ **Customizable**: Extensive settings with import/export functionality
- 🎯 **AI Models**: Support for multiple AI models (GPT-4, Claude, Gemini)

## Getting Started

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn

### Installation

1. Clone the repository or download the files
2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
├── components/
│   ├── ui/                 # Reusable UI components
│   ├── ChatApp.tsx         # Main chat application
│   ├── ChatHeader.tsx      # Chat header with controls
│   ├── ChatMessages.tsx    # Message display component
│   ├── ChatInput.tsx       # Message input component
│   ├── ChatSidebar.tsx     # Conversation sidebar
│   └── SettingsPanel.tsx   # Settings configuration
├── styles/
│   └── globals.css         # Global styles and CSS variables
├── App.tsx                 # Root application component
├── main.tsx               # Application entry point
└── index.html             # HTML template
```

## Key Features

### Theme System
- **Light Mode**: Clean, bright interface
- **Dark Mode**: Easy on the eyes for low-light environments
- **System Mode**: Automatically matches your OS preference

### Mobile Experience
- Collapsible sidebar with hamburger menu
- Touch-friendly interface
- Optimized layout for small screens
- Simplified controls on mobile

### Message Interactions
- **Hover Actions**: Quick access to copy, regenerate, and rate messages
- **Context Menu**: Right-click for additional options
- **Keyboard Shortcuts**: Full keyboard navigation support
- **Message Rating**: Thumbs up/down for AI responses

### Settings & Customization
- **AI Model Selection**: Choose from GPT-4, Claude, Gemini, and more
- **Temperature Control**: Adjust AI creativity/randomness
- **Font Size**: Customize text size for better readability
- **Language Support**: Multiple language options
- **Import/Export**: Backup and restore your settings

## Technologies Used

- **React 18**: Modern React with hooks
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework
- **Radix UI**: Accessible component primitives
- **Lucide React**: Beautiful icon library
- **Vite**: Fast build tool and dev server

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the MIT License.