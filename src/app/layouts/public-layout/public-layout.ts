import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BrandPanel } from './brand-panel/brand-panel';

/** Shell for unauthenticated pages (register, login): brand panel on desktop + page content. */
@Component({
  selector: 'app-public-layout',
  imports: [RouterOutlet, BrandPanel],
  templateUrl: './public-layout.html',
  styleUrl: './public-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicLayout {}
