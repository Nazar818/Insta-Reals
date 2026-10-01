import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.mark} accessible={false}>
          <View style={styles.play} />
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          Insta Reals
        </Text>
        <Text style={styles.subtitle}>A new perspective.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#101014',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  mark: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: '#f2527d',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  play: {
    width: 0,
    height: 0,
    borderTopWidth: 12,
    borderBottomWidth: 12,
    borderLeftWidth: 19,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#101014',
    marginLeft: 4,
  },
  title: {
    color: '#f8f8fa',
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -1,
    textAlign: 'center',
  },
  subtitle: {
    color: '#aaaab4',
    fontSize: 16,
    textAlign: 'center',
  },
});
