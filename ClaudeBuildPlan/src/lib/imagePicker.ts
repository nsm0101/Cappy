import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

export type PickedImage = { base64: string; uri: string };

/**
 * Launch the photo library, let the user crop to a square (iOS shows the
 * native square crop UI via `allowsEditing` + `aspect`), then downscale to
 * a 512×512 JPEG and return its base64. Returns null if the user cancels
 * or denies permission.
 */
export const pickAndCropSquareImage = async (): Promise<PickedImage | null> => {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  const asset = result.canceled ? undefined : result.assets?.[0];
  if (!asset) return null;

  const manipulated = await ImageManipulator.manipulateAsync(
    asset.uri,
    [{ resize: { width: 512, height: 512 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );
  if (!manipulated.base64) return null;
  return { base64: manipulated.base64, uri: manipulated.uri };
};
