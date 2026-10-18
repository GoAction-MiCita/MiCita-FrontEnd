import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** Shell for unauthenticated pages (register, login). */
@Component({
  selector: 'app-public-layout',
  imports: [RouterOutlet],
  template: '<main class="public-layout"><router-outlet /></main>',
  styleUrl: './public-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicLayout {}
