import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ZardSonnerComponent } from '@/shared/components/sonner';

@Component({
  selector: 'vm-root',
  imports: [RouterOutlet, ZardSonnerComponent],
  template: `
    <router-outlet />
    <z-sonner theme="light" position="bottom-right" [closeButton]="true" />
  `,
})
export class App {}
