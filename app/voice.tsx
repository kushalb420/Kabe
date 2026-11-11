import React from 'react';
import { LogFlow } from '../src/components/LogFlow';

/** Log a meal by speaking (on the web, the browser listens and writes what you said). */
export default function Voice() {
  return <LogFlow mode="voice" />;
}
