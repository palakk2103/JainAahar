import { Suspense, useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import AppRouter from '@core/routes/AppRouter';
import { AuthProvider } from '@core/context/AuthContext';
import { SettingsProvider } from '@core/context/SettingsContext';
import { SupportUnreadProvider } from '@core/context/SupportUnreadContext';
import { LanguageProvider } from '@core/context/LanguageContext';
import SeoHead from '@core/components/SeoHead';
import { ToastProvider } from './shared/components/ui/Toast';
import Loader from './shared/components/ui/Loader';
import ErrorBoundary from './shared/components/ErrorBoundary';
import LenisScroll from './shared/components/LenisScroll';
import SplashScreen from './shared/components/ui/SplashScreen';

function App() {
    useEffect(() => {
        // Setup hardware back button and deep link listeners for Capacitor apps
        const setupCapacitorListeners = async () => {
            try {
                await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
                    // Check if an active modal or sheet intercepts the back action
                    const backEvent = new CustomEvent('app:back', { cancelable: true });
                    const isHandled = !window.dispatchEvent(backEvent);
                    if (isHandled) {
                        return;
                    }

                    const currentPath = window.location.pathname;
                    const isRoot = currentPath === '/' || currentPath === '/home';

                    if (!isRoot && canGoBack) {
                        window.history.back();
                    } else if (isRoot) {
                        CapacitorApp.exitApp();
                    } else if (canGoBack) {
                        window.history.back();
                    } else {
                        CapacitorApp.exitApp();
                    }
                });

                await CapacitorApp.addListener('appUrlOpen', (event) => {
                    try {
                        const url = new URL(event.url);
                        const slug = url.pathname + url.search;
                        if (slug && slug !== '/') {
                            window.location.href = slug;
                        }
                    } catch (e) {
                        const raw = String(event?.url || '');
                        const match = raw.match(/:\/\/[^/]+(\/.*)/);
                        if (match && match[1]) {
                            window.location.href = match[1];
                        }
                    }
                });
            } catch (err) {
                // Ignore errors if running in a standard web browser (not capacitor)
            }
        };
        setupCapacitorListeners();
        
        return () => {
            try {
                CapacitorApp.removeAllListeners();
            } catch (err) {}
        };
    }, []);

    return (
        <ErrorBoundary>
            <AuthProvider>
                <LanguageProvider>
                    <SettingsProvider>
                        <SeoHead />
                        <ToastProvider>
                            <Suspense fallback={<Loader fullScreen />}>
                                <SupportUnreadProvider>
                                    <LenisScroll />
                                    <SplashScreen>
                                        <AppRouter />
                                    </SplashScreen>
                                </SupportUnreadProvider>
                            </Suspense>
                        </ToastProvider>
                    </SettingsProvider>
                </LanguageProvider>
            </AuthProvider>
        </ErrorBoundary>
    );
}

export default App;
