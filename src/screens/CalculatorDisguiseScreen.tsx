import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Dimensions,
} from 'react-native';
import { SecurityService } from '../services/SecurityService';

interface CalculatorDisguiseProps {
  onUnlock: (isDuress: boolean) => void;
}

export default function CalculatorDisguiseScreen({ onUnlock }: CalculatorDisguiseProps) {
  const [display, setDisplay] = useState('0');
  const [currentInput, setCurrentInput] = useState('');
  const [lastOperator, setLastOperator] = useState<string | null>(null);

  const handlePress = async (val: string) => {
    if (val === 'C') {
      setDisplay('0');
      setCurrentInput('');
      setLastOperator(null);
      return;
    }

    if (val === '=') {
      // 1. Check if the entered sequence is the secret passcode, duress passcode, or panic wipe code!
      const auth = await SecurityService.verifyCode(currentInput || display);
      if (auth.isPanic) {
        setDisplay('0');
        setCurrentInput('');
        setLastOperator(null);
        return;
      }

      if (auth.authenticated) {
        onUnlock(auth.isDuress);
        return;
      }

      // 2. Otherwise calculate standard math expression safely
      try {
        const cleanExpr = display.replace(/×/g, '*').replace(/÷/g, '/');
        // Basic safe calculation
        const result = Function(`'use strict'; return (${cleanExpr})`)();
        setDisplay(String(result).slice(0, 10));
        setCurrentInput(String(result));
      } catch {
        setDisplay('Error');
        setCurrentInput('');
      }
      return;
    }

    // Number or operator
    if (display === '0' || display === 'Error') {
      setDisplay(val);
      setCurrentInput(val);
    } else {
      setDisplay(display + val);
      setCurrentInput(currentInput + val);
    }
  };

  const renderButton = (text: string, type: 'digit' | 'operator' | 'action', span = 1) => {
    const bgColors = {
      digit: '#334155',
      operator: '#8B5CF6',
      action: '#475569',
    };

    return (
      <TouchableOpacity
        key={text}
        activeOpacity={0.7}
        style={[
          styles.button,
          { backgroundColor: bgColors[type] },
          span === 2 && styles.buttonSpan2,
        ]}
        onPress={() => handlePress(text)}
      >
        <Text style={styles.buttonText}>{text}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* Calculator Display */}
      <View style={styles.displayContainer}>
        <Text style={styles.displayText} numberOfLines={1} adjustsFontSizeToFit>
          {display}
        </Text>
      </View>

      {/* Button Grid */}
      <View style={styles.keypad}>
        <View style={styles.row}>
          {renderButton('C', 'action')}
          {renderButton('±', 'action')}
          {renderButton('%', 'action')}
          {renderButton('÷', 'operator')}
        </View>
        <View style={styles.row}>
          {renderButton('7', 'digit')}
          {renderButton('8', 'digit')}
          {renderButton('9', 'digit')}
          {renderButton('×', 'operator')}
        </View>
        <View style={styles.row}>
          {renderButton('4', 'digit')}
          {renderButton('5', 'digit')}
          {renderButton('6', 'digit')}
          {renderButton('-', 'operator')}
        </View>
        <View style={styles.row}>
          {renderButton('1', 'digit')}
          {renderButton('2', 'digit')}
          {renderButton('3', 'digit')}
          {renderButton('+', 'operator')}
        </View>
        <View style={styles.row}>
          {renderButton('0', 'digit', 2)}
          {renderButton('.', 'digit')}
          {renderButton('=', 'operator')}
        </View>
      </View>
    </SafeAreaView>
  );
}

const screenWidth = Dimensions.get('window').width;
const btnMargin = 8;
const btnSize = (screenWidth - btnMargin * 10) / 4;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'flex-end',
  },
  displayContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  displayText: {
    color: '#FFFFFF',
    fontSize: 64,
    fontWeight: '300',
  },
  keypad: {
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: btnMargin,
  },
  button: {
    width: btnSize,
    height: btnSize,
    borderRadius: btnSize / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonSpan2: {
    width: btnSize * 2 + btnMargin,
    borderRadius: btnSize / 2,
    alignItems: 'flex-start',
    paddingLeft: btnSize * 0.4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '500',
  },
});
