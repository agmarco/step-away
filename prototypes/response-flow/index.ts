import { registerRootComponent } from 'expo';

// The background task must be defined at module scope, before the app registers.
import './probe/task';
import Probe from './probe/Probe';

// Branch prototype/background-responses runs the probe (#12); App.tsx is the Response flow prototype (#9).
registerRootComponent(Probe);
