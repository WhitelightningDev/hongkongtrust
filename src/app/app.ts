import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Footer } from "./components/footer/footer";
import { AuthService } from './interceptors/auth.service';


@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Footer],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected title = 'hongkongtrust';

  constructor(private authService: AuthService) {}

  async ngOnInit() {
    try {
      await this.authService.initAuth();
      console.log('Authentication initialized successfully.');
    } catch (error) {
      console.error('Failed to initialize authentication:', error);
    }
  }
}
