import { Ionicons as Base } from '@expo/vector-icons';
import React from 'react';
import { pageColor, useOnSurface } from './Surface';
import { useColors } from '../theme';

type Props = React.ComponentProps<typeof Base>;

/** The same icons as before; on a dark page the dark ink colours turn light (see Surface.tsx). */
function IconImpl({ color, ...rest }: Props) {
  const c = useColors();
  const onSurface = useOnSurface();
  return <Base {...rest} color={pageColor(color, c, onSurface) as string} />;
}
export const Ionicons = Object.assign(IconImpl, { glyphMap: Base.glyphMap });
