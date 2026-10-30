// App entry. The background notification task must be defined at module
// scope before the app registers, so it is imported first; then Expo Router's
// own entry registers the app.
import './platform/task';
import 'expo-router/entry';
