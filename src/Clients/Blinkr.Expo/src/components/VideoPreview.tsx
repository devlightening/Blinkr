import { useVideoPlayer, VideoView } from 'expo-video';
import type { StyleProp, ViewStyle } from 'react-native';

type Props = {
  style?: StyleProp<ViewStyle>;
  uri: string;
};

export const VideoPreview = ({ uri, style }: Props) => {
  const player = useVideoPlayer(uri);
  return <VideoView contentFit="cover" nativeControls player={player} style={style} />;
};
