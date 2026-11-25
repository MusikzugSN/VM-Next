import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** Root: only the router. Toasts live in the app shell (lazy), so ngx-sonner stays out of the initial bundle. */
@Component({
  selector: 'vm-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
})
export class App {}
