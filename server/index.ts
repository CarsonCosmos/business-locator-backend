<?xml version="1.0" encoding="utf-8"?>
<Project name="My Movie" themeId="0" version="65540" templateID="SimpleProjectTemplate">
  <MediaItems>
    <MediaItem id="3" filePath="C:\Users\webigal1974\Desktop\VID_20150917_215436_369.mp4" arWidth="1280" arHeight="720" duration="29.5914009" songTitle="" songArtist="" songAlbum="" songCopyrightUrl="" songArtistUrl="" songAudioFileUrl="" stabilizationMode="0" mediaItemType="1" />
  </MediaItems>
  <Extents>
    <VideoClip extentID="6" gapBefore="0" mediaItemID="3" inTime="0" outTime="7.0969928999999992" speed="1" stabilizationMode="0">
      <Effects />
      <Transitions />
      <BoundProperties>
        <BoundPropertyBool Name="Mute" Value="false" />
        <BoundPropertyInt Name="rotateStepNinety" Value="0" />
        <BoundPropertyFloat Name="Volume" Value="1" />
      </BoundProperties>
    </VideoClip>
    <VideoClip extentID="8" gapBefore="0" mediaItemID="3" inTime="22.130326233333335" outTime="25.930326233333336" speed="1" stabilizationMode="0">
      <Effects />
      <Transitions />
      <BoundProperties>
        <BoundPropertyBool Name="Mute" Value="false" />
        <BoundPropertyInt Name="rotateStepNinety" Value="0" />
        <BoundPropertyFloat Name="Volume" Value="1" />
      </BoundProperties>
    </VideoClip>
    <ExtentSelector extentID="1" gapBefore="0" primaryTrack="true">
      <Effects />
      <Transitions />
      <BoundProperties />
      <ExtentRefs>
        <ExtentRef id="6" />
        <ExtentRef id="8" />
      </ExtentRefs>
    </ExtentSelector>
    <ExtentSelector extentID="2" gapBefore="0" primaryTrack="false">
      <Effects />
      <Transitions />
      <BoundProperties />
      <ExtentRefs />
    </ExtentSelector>
    <ExtentSelector extentID="3" gapBefore="0" primaryTrack="false">
      <Effects />
      <Transitions />
      <BoundProperties />
      <ExtentRefs />
    </ExtentSelector>
    <ExtentSelector extentID="4" gapBefore="0" primaryTrack="false">
      <Effects />
      <Transitions />
      <BoundProperties />
      <ExtentRefs />
    </ExtentSelector>
  </Extents>
  <BoundPlaceholders>
    <BoundPlaceholder placeholderID="SingleExtentView" extentID="0" />
    <BoundPlaceholder placeholderID="Main" extentID="1" />
    <BoundPlaceholder placeholderID="SoundTrack" extentID="2" />
    <BoundPlaceholder placeholderID="Text" extentID="4" />
    <BoundPlaceholder placeholderID="Narration" extentID="3" />
  </BoundPlaceholders>
  <BoundProperties>
    <BoundPropertyFloatSet Name="AspectRatio">
      <BoundPropertyFloatElement Value="1.7777776718139648" />
    </BoundPropertyFloatSet>
    <BoundPropertyFloat Name="DuckedNarrationAndSoundTrackMix" Value="0.5" />
    <BoundPropertyFloat Name="DuckedVideoAndNarrationMix" Value="0" />
    <BoundPropertyFloat Name="DuckedVideoAndSoundTrackMix" Value="0" />
    <BoundPropertyFloat Name="SoundTrackMix" Value="0" />
  </BoundProperties>
  <ThemeOperationLog themeID="0">
    <MonolithicThemeOperations />
  </ThemeOperationLog>
  <AudioDuckingProperties emphasisPlaceholderID="Narration" />
</Project>
