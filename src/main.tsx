import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { PlanProvider } from './context/PlanContext.tsx';
import { AppErrorBoundary, installGlobalErrorHandlers } from './components/AppErrorBoundary';

installGlobalErrorHandlers();

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <PlanProvider>
      <App />
    </PlanProvider>
  </AppErrorBoundary>
);
