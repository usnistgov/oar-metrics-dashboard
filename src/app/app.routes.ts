import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { GuideComponent } from './components/guide/guide.component';
import { CollectionsLandingComponent } from './components/collections-landing/collections-landing.component';
import { CollectionScopedComponent } from './components/collection-scoped/collection-scoped.component';

export const routes: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'collections', component: CollectionsLandingComponent },
  { path: 'collections/:id', component: CollectionScopedComponent },
  { path: 'guide', component: GuideComponent },
  { path: '**', redirectTo: '' },
];
