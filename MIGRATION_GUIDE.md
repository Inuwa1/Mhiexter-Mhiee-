# Migration Guide: Web to Expo (React Native)

This guide maps the web-based components and APIs used in your current application to their React Native/Expo equivalents.

## Component Mapping

| Web Component | React Native / Expo Equivalent |
| :--- | :--- |
| `div` | `View` |
| `p` | `Text` |
| `button` | `TouchableOpacity` or `Pressable` |
| `input` | `TextInput` |
| `video` | `CameraView` (from `expo-camera`) |
| `canvas` | `Canvas` (from `react-native-canvas` or similar) |
| `X` (icon) | `Ionicons` (or other icon library) |

## API Mapping

| Web API | Expo / React Native Equivalent |
| :--- | :--- |
| `navigator.mediaDevices.getUserMedia` | `useCameraPermissions` / `CameraView` (from `expo-camera`) |
| `AudioContext` / `ScriptProcessorNode` | `Audio` (from `expo-av`) |
| `MediaRecorder` | `expo-av` (for recording) |
| `FileReader` / `atob` / `btoa` | `FileSystem` (from `expo-file-system`) |
| `setTimeout` (for loops) | `setInterval` / `requestAnimationFrame` |

## Next Steps for Migration

1.  **Export Code:** Download your project from AI Studio.
2.  **Initialize Expo:** Run `npx create-expo-app@latest`.
3.  **Install Dependencies:** Install `expo-camera`, `expo-av`, `expo-file-system`.
4.  **Migrate Components:** Replace web components with React Native components.
5.  **Migrate Logic:** Copy the modularized logic from `src/services/` into your new Expo project.
