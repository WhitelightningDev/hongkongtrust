import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-welcomepage',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './welcomepage.html',
  styleUrls: ['./welcomepage.css']
})
export class Welcomepage implements OnInit {
  isConfirmed = false;

  // Typewriter splash state
  fullText = 'Welcome to the future of investments';
  displayText = '';
  showSplash = true;
  private index = 0;

  constructor(private router: Router, private route: ActivatedRoute) {}

  ngOnInit(): void {
    // Handle payment status query params routing
    this.route.queryParams.subscribe(params => {
      const paymentStatus = params['payment'];
      if (paymentStatus === 'success') {
        this.router.navigate(['/success'], { replaceUrl: true });
      } else if (paymentStatus === 'cancel') {
        this.router.navigate(['/cancel'], { replaceUrl: true });
      } else if (paymentStatus === 'failure') {
        this.router.navigate(['/failure'], { replaceUrl: true });
      }
    });

    // Start the typewriter effect for splash
    this.typeWriterEffect();
  }

  typeWriterEffect() {
    if (this.index < this.fullText.length) {
      this.displayText += this.fullText.charAt(this.index);
      this.index++;
      setTimeout(() => this.typeWriterEffect(), 100); // typing speed in ms
    } else {
      // After typing, keep splash visible for 1s then hide
      setTimeout(() => (this.showSplash = false), 1000);
    }
  }

  continue(): void {
    if (this.isConfirmed) {
      this.router.navigate(['/homepage']);
    }
  }

  downloadPdf(url: string, filename: string): void {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
