import { useMemo } from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { parseRichText, type Mention } from '../../richText';
import { colors } from '../../theme';

type Props = {
  text: string;
  /** People the server resolved in this text; only they become links. */
  mentions?: Mention[] | null;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  onMention?: (mention: Mention) => void;
  onHashtag?: (tag: string) => void;
  testID?: string;
};

/**
 * User text with @mentions and #hashtags (V2-4, D-027): a resolved @name opens that person, a #tag opens its feed.
 * Unresolved names stay plain text, so nothing looks like a link the server did not confirm.
 */
export function RichText({ text, mentions, style, numberOfLines, onMention, onHashtag, testID }: Props) {
  const segments = useMemo(() => parseRichText(text, mentions ?? []), [text, mentions]);
  return (
    <Text numberOfLines={numberOfLines} style={style} testID={testID}>
      {segments.map((segment, index) => {
        if (segment.kind === 'mention') {
          return onMention
            ? <Text accessibilityRole="link" key={index} onPress={() => onMention({ userId: segment.userId, userName: segment.userName })} style={styles.link}>{segment.text}</Text>
            : <Text key={index} style={styles.link}>{segment.text}</Text>;
        }
        if (segment.kind === 'hashtag') {
          return onHashtag
            ? <Text accessibilityRole="link" key={index} onPress={() => onHashtag(segment.tag)} style={styles.link}>{segment.text}</Text>
            : <Text key={index} style={styles.link}>{segment.text}</Text>;
        }
        return segment.text;
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  link: { color: colors.blue, fontWeight: '600' },
});
