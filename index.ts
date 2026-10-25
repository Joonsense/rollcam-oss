import { registerRootComponent } from 'expo';

import App from './App';
import { registerWidget } from './src/widget/widget';
import { applyLang } from './src/lib/lang';

// Korean or English, before anything renders (the widget task included)
applyLang();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
// Android home screen widget: its background task renders from the roll on disk
registerWidget();
