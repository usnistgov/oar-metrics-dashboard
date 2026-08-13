import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';

/** Shows the current date as a small subtitle (next to the Latest Downloads title) and ticks it once a second. */
@Component({
  selector: 'app-current-date',
  imports: [CommonModule],
  templateUrl: './current-date.component.html',
  styleUrl: './current-date.component.css'
})
export class CurrentDateComponent implements OnInit, OnDestroy {
  currentDate = new Date(); // Property to hold the current Date object.

  // Handle to the ticking interval so it can be cleared on destroy (prevents a leak).
  private intervalId?: ReturnType<typeof setInterval>;

  // Lifecycle hook: start the per-second clock once the component is initialized.
  ngOnInit(): void {
    this.intervalId = setInterval(() => {
      this.currentDate = new Date(); // Updates the date, which will trigger UI refresh if bound.
    }, 1000); // Updates every 1000 milliseconds (1 second).
  }

  // Lifecycle hook: stop the interval so it does not keep firing after the component is gone.
  ngOnDestroy(): void {
    if (this.intervalId !== undefined) {
      clearInterval(this.intervalId);
    }
  }
}
