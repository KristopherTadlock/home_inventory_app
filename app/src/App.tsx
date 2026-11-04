import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { selfCheck } from 'core-bridge';

function App(): React.JSX.Element {
  useEffect(() => {
    console.log('core self-check', JSON.stringify(selfCheck()));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hello World</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
  },
});

export default App;
