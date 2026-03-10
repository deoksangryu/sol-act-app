import React, { createContext, useContext } from 'react';
import type { User, ClassInfo } from '../types';

interface AppContextType {
  allUsers: User[];
  classes: ClassInfo[];
  setClasses: (classes: ClassInfo[]) => void;
}

const AppContext = createContext<AppContextType>({
  allUsers: [],
  classes: [],
  setClasses: () => {},
});

export const useAppData = () => useContext(AppContext);

export const AppDataProvider = AppContext.Provider;
