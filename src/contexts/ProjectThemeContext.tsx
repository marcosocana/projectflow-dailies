import { createContext, useContext, ReactNode } from 'react';
import { useProjectAccess } from '@/hooks/useProjectAccess';

interface ProjectThemeContextType {
  themeColor: string;
  isUsingProjectTheme: boolean;
}

const ProjectThemeContext = createContext<ProjectThemeContextType | undefined>(undefined);

interface ProjectThemeProviderProps {
  children: ReactNode;
}

export const ProjectThemeProvider = ({ children }: ProjectThemeProviderProps) => {
  const { currentProject } = useProjectAccess();
  
  const themeColor = currentProject?.theme_color || '#3B82F6';
  const isUsingProjectTheme = !!currentProject?.theme_color;

  return (
    <ProjectThemeContext.Provider 
      value={{ 
        themeColor, 
        isUsingProjectTheme 
      }}
    >
      {children}
    </ProjectThemeContext.Provider>
  );
};

export const useProjectTheme = () => {
  const context = useContext(ProjectThemeContext);
  if (context === undefined) {
    throw new Error('useProjectTheme must be used within a ProjectThemeProvider');
  }
  return context;
};