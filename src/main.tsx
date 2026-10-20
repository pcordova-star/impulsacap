import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { PlanProvider } from './context/PlanContext.tsx';

createRoot(document.getElementById('root')!).render(
  <PlanProvider>
    <App />
  </PlanProvider>
);
