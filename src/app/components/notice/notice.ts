import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-notice',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notice.html',
  styleUrls: ['./notice.css']
})
export class Notice {
  termsAccepted = false;

  @Output() onAccept = new EventEmitter<void>();
  @Output() onClose = new EventEmitter<void>();

  acceptTerms() {
    if (this.termsAccepted) {
      this.onAccept.emit();
    }
  }

  closeModal() {
    this.onClose.emit();
  }
}