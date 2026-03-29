import React from 'react';
import { StyleSheet, Text, View, Button } from 'react-native';
import { CameraView } from 'expo-camera';
import { useLiveSession } from './hooks/useLiveSession';

export default function App() {
  const { isLive, cameraRef, startLiveSession, transcription } = useLiveSession();

  return (
    <View style={styles.container}>
      {isLive ? (
        <CameraView style={styles.camera} ref={cameraRef} facing="front">
          <View style={styles.overlay}>
            <Text style={styles.transcription}>{transcription}</Text>
          </View>
        </CameraView>
      ) : (
        <Button title="Start Mhiee" onPress={startLiveSession} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  camera: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'flex-end', padding: 20 },
  transcription: { color: 'white', backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 10 },
});
