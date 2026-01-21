# Patient Rounding Assistant Pro

A professional medical rounding tool for healthcare providers built with React, TypeScript, and Lovable Cloud.

## 🏥 Features

- **Patient Management** - Add, edit, and organize patients for daily rounds
- **Systems Review** - Structured organ system documentation
- **Clinical Phrases** - Quick-insert templates for common findings
- **IBCC Reference** - Integrated critical care reference (Ctrl+I)
- **Change Tracking** - Track daily updates with timestamps
- **Dictation** - Voice-to-text for hands-free documentation
- **Offline Support** - Continue working without internet
- **Print/Export** - PDF, Excel, and print outputs

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm or bun package manager

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd patient-rounding-assistant

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at http://localhost:8080

### Environment Variables

This project uses Lovable Cloud for backend services. Environment variables are automatically configured when deployed through Lovable.

For local development, ensure you have:
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Your Supabase anon key
- `VITE_SUPABASE_PROJECT_ID` - Your Supabase project ID

> ⚠️ **Security Warning**: Never commit `.env` files with real credentials to version control.

## 📚 Documentation

- [Architecture Overview](./src/docs/ARCHITECTURE.md) - System design and patterns
- [Contributing Guide](./CONTRIBUTING.md) - How to contribute

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run in watch mode
npm run test:watch
```

## 🔧 Development

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm test` | Run tests |
| `npm run lint` | Run ESLint |

### Project Structure

```
src/
├── components/     # React components
├── hooks/          # Custom React hooks
├── lib/            # Utility libraries
├── pages/          # Route components
├── types/          # TypeScript types
├── contexts/       # React contexts
└── test/           # Test utilities
```

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + I` | Open IBCC Reference |
| `Ctrl + Shift + M` | Toggle Change Tracking |
| `Ctrl + Shift + D` | Start Dictation |
| `Ctrl + P` | Print/Export |
| `?` | Show keyboard shortcuts |

## 🔒 Security

- All patient data is protected by Row Level Security (RLS)
- Users can only access their own patient records
- Authentication required for all data operations
- HIPAA-conscious design principles

## 🌐 Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 📱 Mobile Support

The application is fully responsive and optimized for:
- iOS Safari
- Android Chrome
- Tablet devices

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## 📄 License

Private - All rights reserved.

## 🆘 Troubleshooting

### Common Issues

**Blank screen after loading**
- Clear browser cache and reload
- Check browser console for errors
- Ensure JavaScript is enabled

**Data not syncing**
- Check internet connection
- Look for offline indicator
- Data will sync when connection is restored

**Authentication issues**
- Clear localStorage and try again
- Ensure email is verified (if applicable)

### Getting Help

Open an issue in the repository with:
1. Description of the problem
2. Steps to reproduce
3. Browser and OS version
4. Console error messages (if any)
