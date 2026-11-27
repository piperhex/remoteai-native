import { Pressable, Text, View } from 'react-native';
import type { LinkProtocol } from '../../vendor/shared/port-mapping/settings';
import { t } from '../i18n';
import { useMappingEditorStyles } from './mappingEditorStyles';

const LINK_PROTOCOLS = ['http', 'https'] as const;

export function MappingLinkProtocolField({ value, onChange, disabled }: {
  value: LinkProtocol;
  onChange: (value: LinkProtocol) => void;
  disabled: boolean;
}) {
  const styles = useMappingEditorStyles();
  const label = t('client.mappingEditor.linkProtocol');
  return <View style={styles.section}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.choices} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {LINK_PROTOCOLS.map(protocol => {
        const selected = value === protocol;
        const name = protocol.toUpperCase();
        return <Pressable key={protocol} accessibilityRole="radio" accessibilityLabel={name}
          accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={() => onChange(protocol)}
          style={[styles.choice, selected && styles.selected, disabled && styles.disabled]}>
          <Text style={[styles.choiceText, selected && styles.selectedText]}>{name}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}
