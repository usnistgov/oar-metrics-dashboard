import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { GuideComponent } from './components/guide/guide.component';

export const routes: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'guide', component: GuideComponent },
  { path: '**', redirectTo: '' },
];
