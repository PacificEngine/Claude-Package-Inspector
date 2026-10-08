import './styles.css';
import { mount } from './ui/app';

const root = document.getElementById('app');
if (!root) throw new Error('#app element is missing');

const seedParam = Number(new URLSearchParams(location.search).get('seed'));
mount(root, seedParam || Date.now() % 100000);
