import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';
import DashboardLayout from '@/layouts/DashboardLayout';
import DashboardPage from '@/pages/DashboardPage';
import RecordingsPage from '@/pages/RecordingsPage';
import SignInPage from '@/pages/SignInPage';
import SignUpPage from '@/pages/SignUpPage';
import '@/theme.css';
import { Providers } from '@/components/Providers';
import { GuestLayout } from './layouts/GuestLayout';
import { HomePage } from './pages/HomePage';
import { RecordingPage } from './pages/RecordingPage';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route element={<GuestLayout />}>
            <Route path="/sign-in" element={<SignInPage />} />
            <Route path="/sign-up" element={<SignUpPage />} />
          </Route>
          <Route element={<DashboardLayout />}>
            <Route index path="/dashboard" element={<DashboardPage />} />
            <Route path="/recordings" element={<RecordingsPage />} />
            <Route path="/recordings/:recordingId" element={<RecordingPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </Providers>
  </StrictMode>
);
