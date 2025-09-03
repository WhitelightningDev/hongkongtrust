import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Notice } from '../../components/notice/notice'; // Adjust path if needed
import { PrivacyPolicy } from '../../components/privacy-policy/privacy-policy'; // Adjust path if needed

@Component({
  selector: 'app-welcomepage',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PrivacyPolicy],
  templateUrl: './welcomepage.html',
  styleUrls: ['./welcomepage.css']
})
export class Welcomepage implements OnInit {
  showModal = false;

  fullText = 'Welcome to the future of investments';
  displayText = '';
  showSplash = true;
  private index = 0;

  constructor(private router: Router, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.showModal = true; // show modal when page loads

    this.route.queryParams.subscribe(params => {
      const status = params['payment'];
      if (status === 'success') this.router.navigate(['/success'], { replaceUrl: true });
      else if (status === 'cancel') this.router.navigate(['/cancel'], { replaceUrl: true });
      else if (status === 'failure') this.router.navigate(['/failure'], { replaceUrl: true });
    });

    this.typeWriterEffect();
  }

  typeWriterEffect() {
    if (this.index < this.fullText.length) {
      this.displayText += this.fullText.charAt(this.index++);
      setTimeout(() => this.typeWriterEffect(), 100);
    } else {
      setTimeout(() => (this.showSplash = false), 1000);
    }
  }

  openTermsPopup(event: Event): void {
    event.preventDefault(); // stop href="#"
    this.showModal = true;  // triggers *ngIf
  }

  acceptTerms(): void {
    this.showModal = false;
    this.router.navigate(['/homepage']);
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