import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { Buffer } from 'buffer';

global.Buffer = global.Buffer || Buffer;

import { DEEPGRAM_API_KEY } from '@env';

export default function App() {
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [questionCount, setQuestionCount] = useState(0);
  const [talkingTime, setTalkingTime] = useState(0);
  const [checkUnderstandingCount, setCheckUnderstandingCount] = useState(0);
  const [screen, setScreen] = useState('home');

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        alert('Microphone permission is required!');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
      );

      setRecording(recording);
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const stopRecording = async () => {
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setIsRecording(false);
      setRecording(null);
      await sendToDeepgram(uri);
      setScreen('results');
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  const sendToDeepgram = async (fileUri) => {
    try {
      const fileBase64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const audioBuffer = Buffer.from(fileBase64, 'base64');

      const response = await fetch('https://api.deepgram.com/v1/listen?punctuate=true', {
        method: 'POST',
        headers: {
          Authorization: `Token ${DEEPGRAM_API_KEY}`,
          'Content-Type': 'audio/m4a',
        },
        body: audioBuffer,
      });

      const result = await response.json();

      if (result?.results?.channels?.[0]?.alternatives?.[0]) {
        const fullTranscript = result.results.channels[0].alternatives[0].transcript;
        setTranscript(fullTranscript);

        const questionWords = [
          'who', 'what', 'when', 'where', 'why', 'how',
          'is', 'are', 'do', 'does', 'can', 'could', 'should', 'would'
        ];

        const questions = fullTranscript
          .split(/[.?!]/)
          .map((s) => s.trim().toLowerCase())
          .filter((sentence) =>
            questionWords.some((word) => sentence.startsWith(word))
          );

        const count = questions.length;
        setQuestionCount(count);
        setCheckUnderstandingCount(0); // Customize this logic later

        // Estimate talking time (words / 150 wpm = seconds → %)
        const words = fullTranscript.split(/\s+/).length;
        const estimatedTimeInSeconds = words / 2.5; // ~150 words per minute
        const percentage = Math.min(100, Math.round((estimatedTimeInSeconds / 60) * 100));
        setTalkingTime(percentage);

        if (count > 0) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      } else {
        setTranscript('Could not transcribe the audio.');
        setQuestionCount(0);
      }
    } catch (error) {
      console.error('Error sending to Deepgram:', error);
      setTranscript('Error occurred while transcribing.');
      setQuestionCount(0);
    }
  };

  const rateFeedback = (rating) => {
    // You can replace this alert with API calls or other logic to store the rating.
    Alert.alert("Feedback", `Thank you for your ${rating} feedback!`);
  };

  const resetApp = () => {
    setScreen('home');
    setTranscript('');
    setQuestionCount(0);
    setTalkingTime(0);
    setCheckUnderstandingCount(0);
  };

  if (screen === 'home') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>🎙️ Coral Smartwatch</Text>
        <TouchableOpacity
          style={styles.recordButton}
          onPress={isRecording ? stopRecording : startRecording}
        >
          <Text style={styles.buttonText}>{isRecording ? 'Stop' : 'Record'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (screen === 'results') {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Recording Complete!</Text>

        <View style={styles.metricsContainer}>
          <Text style={styles.metricsTitle}>General metrics</Text>

          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Question statements</Text>
            <Text style={styles.metricValue}>{questionCount}</Text>
          </View>

          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Talking time</Text>
            <Text style={styles.metricValue}>{talkingTime}%</Text>
          </View>

          <View style={styles.metricBox}>
            <Text style={styles.metricLabel}>Check for understanding</Text>
            <Text style={styles.metricValue}>{checkUnderstandingCount}</Text>
          </View>
        </View>

        <Text style={styles.transcript}>Transcript: {transcript}</Text>

        {/* New feedback section */}
        <View style={styles.feedbackContainer}>
          <Text style={styles.feedbackTitle}>Feedback Explanation</Text>
          <Text style={styles.feedbackExplanation}>
            Based on your session, you had a talking time of {talkingTime}%. You asked {questionCount} question statements. This helps us understand your engagement and areas to improve clarity.
          </Text>
          <Text style={styles.rateFeedbackText}>Rate this feedback:</Text>
          <View style={styles.ratingButtons}>
            <TouchableOpacity onPress={() => rateFeedback('positive')}>
              <Text style={styles.ratingButton}>👍</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => rateFeedback('negative')}>
              <Text style={styles.ratingButton}>👎</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.finishButton} onPress={resetApp}>
          <Text style={styles.finishButtonText}>Finish</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f2ef',
    padding: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#5a3e36',
  },
  recordButton: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#d9534f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  metricsContainer: {
    marginVertical: 20,
    width: '100%',
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    elevation: 2,
  },
  metricsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#444',
    alignSelf: 'center',
  },
  metricBox: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 16,
    color: '#888',
  },
  metricValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  transcript: {
    marginTop: 20,
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
  feedbackContainer: {
    marginTop: 30,
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    elevation: 2,
    width: '100%',
    alignItems: 'center',
  },
  feedbackTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#444',
  },
  feedbackExplanation: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    marginBottom: 15,
  },
  rateFeedbackText: {
    fontSize: 16,
    marginBottom: 10,
    color: '#333',
  },
  ratingButtons: {
    flexDirection: 'row',
  },
  ratingButton: {
    fontSize: 30,
    marginHorizontal: 15,
  },
  finishButton: {
    marginTop: 30,
    backgroundColor: '#5a3e36',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 30,
  },
  finishButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

