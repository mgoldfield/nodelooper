import { createRoot } from 'react-dom/client';
import './index.css';
import Looper from './looper.js';

const container = document.getElementById('root');
const root = createRoot(container); // createRoot(container!) if you use TypeScript
root.render(<Looper />);