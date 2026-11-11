import React, { createContext, useContext } from 'react';
import { Text as RNText, TextInput as RNTextInput, StyleSheet, TextInputProps, TextProps } from 'react-native';
import { fontFor } from '../lib/fonts';

/** Text that uses the app's fonts. Screens ask for a fontWeight as before; this turns it into the right font file. */
const Nested = createContext(false);

function styled(style: TextProps['style'], inherit: boolean) {
  const { fontWeight, fontFamily, ...rest } = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  // text inside other text keeps the parent's font unless it asks for its own weight
  const family = fontFamily ?? (inherit && fontWeight === undefined ? undefined : fontFor(fontWeight as string | undefined));
  return family ? [rest, { fontFamily: family as string }] : [rest];
}

export function Text({ style, ref, ...props }: TextProps & { ref?: React.Ref<React.ComponentRef<typeof RNText>> }) {
  const inherit = useContext(Nested);
  return (
    <Nested.Provider value>
      <RNText ref={ref} {...props} style={styled(style, inherit) as TextProps['style']} />
    </Nested.Provider>
  );
}

export function TextInput({ style, ref, ...props }: TextInputProps & { ref?: React.Ref<React.ComponentRef<typeof RNTextInput>> }) {
  return <RNTextInput ref={ref} {...props} style={styled(style, false) as TextInputProps['style']} />;
}
