import { useState, useEffect } from 'react';

export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem('theme') || 'system';
  });

  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const applyTheme = (targetTheme) => {
      root.classList.add('theme-transitioning');
      
      let isDark = targetTheme === 'dark';
      if (targetTheme === 'system') {
        isDark = mediaQuery.matches;
      }
      
      root.setAttribute('data-theme', isDark ? 'dark' : 'light');
      
      setTimeout(() => {
        root.classList.remove('theme-transitioning');
      }, 150); // Match CSS transition duration
    };

    applyTheme(theme);

    const listener = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };
    
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, [theme]);

  const setTheme = (newTheme) => {
    localStorage.setItem('theme', newTheme);
    setThemeState(newTheme);
  };

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else setTheme('light');
  };

  return { theme, setTheme, cycleTheme };
}
