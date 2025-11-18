import { createContext, useContext } from 'react';

export const defaultViewerSettings = {
  gridEnabled: false,
};
export type ViewerSettings = typeof defaultViewerSettings;

const ViewerSettingsContext = createContext<{ settings: ViewerSettings }>({
  settings: defaultViewerSettings,
});

export const useViewerSettingsContext = () => useContext(ViewerSettingsContext);
export const ViewerSettingsProvider = ViewerSettingsContext.Provider;

export const useViewerSettings = () => useViewerSettingsContext().settings;
