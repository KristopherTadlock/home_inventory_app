import React from 'react';
import { StyleSheet, View } from 'react-native';

/** A "+" drawn with two bars, so no icon font is needed on any platform. */
export function PlusIcon({
  size = 20,
  thickness = 2.5,
  color,
}: {
  size?: number;
  thickness?: number;
  color: string;
}): React.JSX.Element {
  const bar = { backgroundColor: color, borderRadius: thickness / 2 };
  return (
    <View style={{ width: size, height: size }} accessible={false}>
      <View
        style={[
          styles.bar,
          bar,
          { width: size, height: thickness, top: (size - thickness) / 2 },
        ]}
      />
      <View
        style={[
          styles.bar,
          bar,
          { width: thickness, height: size, left: (size - thickness) / 2 },
        ]}
      />
    </View>
  );
}

/** A "−" matching PlusIcon. */
export function MinusIcon({
  size = 20,
  thickness = 2.5,
  color,
}: {
  size?: number;
  thickness?: number;
  color: string;
}): React.JSX.Element {
  return (
    <View style={{ width: size, height: size }} accessible={false}>
      <View
        style={[
          styles.bar,
          {
            backgroundColor: color,
            borderRadius: thickness / 2,
            width: size,
            height: thickness,
            top: (size - thickness) / 2,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
  },
});
