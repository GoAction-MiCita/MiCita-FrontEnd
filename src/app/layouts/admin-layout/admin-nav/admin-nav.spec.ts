import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AdminNav, AdminNavItem } from './admin-nav';

@Component({ template: '' })
class Blank {}

const items: AdminNavItem[] = [
  { path: '/dashboard', label: 'Inicio', icon: 'home' },
  { path: '/servicios', label: 'Servicios', icon: 'layout-grid' },
];

async function render(url = '/servicios') {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'dashboard', component: Blank },
        { path: 'servicios', component: Blank },
      ]),
    ],
  });
  await TestBed.inject(Router).navigateByUrl(url);
  const fixture = TestBed.createComponent(AdminNav);
  fixture.componentRef.setInput('items', items);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('AdminNav', () => {
  it('renders one link per item inside the main navigation landmark', async () => {
    const element = await render();

    const nav = element.querySelector('nav[aria-label="Principal"]');
    const links = Array.from(nav?.querySelectorAll('a') ?? []);
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/dashboard', '/servicios']);
  });

  it('keeps an accessible name for icon-only links', async () => {
    const element = await render();

    const links = Array.from(element.querySelectorAll('a'));
    expect(links.map((a) => a.textContent?.trim())).toEqual(['Inicio', 'Servicios']);
    expect(links.map((a) => a.getAttribute('title'))).toEqual(['Inicio', 'Servicios']);
  });

  it('marks the current page', async () => {
    const element = await render('/servicios');

    const current = element.querySelector('[aria-current="page"]');
    expect(current?.textContent?.trim()).toBe('Servicios');
    expect(current?.classList).toContain('admin-nav__link--active');
  });
});
