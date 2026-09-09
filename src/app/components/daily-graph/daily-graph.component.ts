import { Component, ElementRef, viewChild, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule, DatePipe } from '@angular/common';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DataSetMetric, DataSetMetricsResponse } from '../../models/metrics.models';
import { log } from '../../logger';

// Registers all necessary components for Chart.js to work, like scales, elements, and chart types.
Chart.register(...registerables);

/**
 * Daily download chart. Not currently mounted on the dashboard - kept for reference. Reads the
 * per-dataset usage metrics and groups activity by day.
 */
@Component({
  selector: 'app-daily-graph',
  standalone: true,
  // Imports required Angular modules for features like HTTP requests, common directives, and forms.
  imports: [CommonModule, FormsModule, MatButtonModule, MatProgressSpinnerModule],
  templateUrl: './daily-graph.component.html', // Links to the HTML template for this component.
  styleUrl: './daily-graph.component.css',     // Links to the CSS styles for this component.
})
export class DailyGraphComponent implements OnInit {
  // Injects the HttpClient service for making API calls.
  httpClient = inject(HttpClient);
  chart: Chart | undefined; // Holds the Chart.js instance.
  chartCanvas = viewChild<ElementRef<HTMLCanvasElement>>('chartCanvas'); // Template ref to the <canvas> this chart renders into.
  filterMonth: string = '';
  filterYear: string = '';
  datePipe = new DatePipe('en-US'); // Used for formatting dates, especially for chart labels.

  allLogs: DataSetMetric[] = []; // Stores all fetched usage logs before filtering.
  loading = signal(false);
  errorMsg = signal<string | null>(null);

  selectedMonthInput: string = ''; // Binds to the month input field in the HTML.
  selectedYearInput: string = '';  // Binds to the year input field in the HTML.
  private _actualMonth: number = new Date().getMonth(); // Internal variable for the currently selected month (0-indexed).
  private _actualYear: number = new Date().getFullYear(); // Internal variable for the currently selected year.

  // Getter for actualMonth with validation to ensure it's a valid month number.
  get actualMonth(): number {
    return this._actualMonth;
  }

  // Setter for actualMonth with validation.
  set actualMonth(month: number) {
    if (month >= 0 && month <= 11) {
      this._actualMonth = month;
    } else {
      log.warn('Invalid month number. Keeping previous month.');
    }
  }

  // Getter for actualYear with validation to ensure it's within a valid range.
  get actualYear(): number {
    return this._actualYear;
  }

  // Setter for actualYear with validation.
  set actualYear(year: number) {
    // Validates that the year is between 2018 and the current year.
    if (year >= 2018 && year <= new Date().getFullYear()) {
      this._actualYear = year;
    } else {
      log.warn('Invalid year number. Keeping previous year.');
    }
  }

  // Lifecycle hook that runs after the component is initialized. Fetches data when the component loads.
  ngOnInit() {
    this.fetchData();
  }

  // Handles applying the month filter based on user input.
  applyMonthFilter() {
    const monthInput = this.selectedMonthInput.trim().toLowerCase();
    let monthNumber: number | null = null;

    const parsedNumber = parseInt(monthInput, 10);
    // Checks if input is a valid number.
    if (!isNaN(parsedNumber)) {
      if (parsedNumber >= 1 && parsedNumber <= 12) {
        monthNumber = parsedNumber - 1; // Adjusts to 0-indexed month.
      }
    } else {
      // If not a number, tries to match input with month names.
      const monthNames = [
        'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september',
        'october', 'november', 'december'
      ];
      const monthIndex = monthNames.indexOf(monthInput);
      if (monthIndex !== -1) {
        monthNumber = monthIndex
      }
    }

    // If a valid month is found, update the actualMonth and fetch data. Otherwise, show an alert.
    if (monthNumber != null) {
      this.actualMonth = monthNumber;
      this.fetchData();
    } else {
      log.warn('Invalid month input:', this.selectedMonthInput);
      alert('Please enter a valid month name (e.g., "April") or number (1-12).');
    }
  }

  // Handles applying the year filter based on user input.
  applyYearFilter() {
    const yearInput = Number(this.selectedYearInput);
    let yearNumber: number | null = null;

    const parsedNumber = yearInput;
    // Checks if the input is a valid year within the allowed range.
    if (!isNaN(parsedNumber)) {
      if (parsedNumber >= 2018 && parsedNumber <= new Date().getFullYear()) {
        yearNumber = parsedNumber;
      }
    }
    // If a valid year is found, update actualYear and fetch data. Otherwise, show an alert.
    if (yearNumber != null) {
      this.actualYear = yearNumber;
      this.fetchData();
    } else {
      log.warn('Invalid year input:', this.selectedYearInput);
      alert('Please enter a valid year (e.g., "2019").');
    }
  }

  // Resets the month filter to the current month and refetches data.
  resetMonthFilter() {
    this.selectedMonthInput = ''; // Clears the input field.
    this.actualMonth = new Date().getMonth(); // Sets month to current month.
    this.fetchData();
  }

  // Resets the year filter to the current year and refetches data.
  resetYearFilter() {
    this.selectedYearInput = ''; // Clears the input field.
    this.actualYear = new Date().getFullYear(); // Sets year to current year.
    this.fetchData();
  }

  // Fetches usage data from the API and filters it by the selected month and year.
  fetchData() {
    this.loading.set(true);
    this.errorMsg.set(null);
    this.httpClient
      .get<DataSetMetricsResponse>('https://data.nist.gov/rmm/usagemetrics/records') // Makes an HTTP GET request to the API endpoint.
      .subscribe(response => {
          this.loading.set(false);
          const allLogs = response?.DataSetMetrics || []; // Extracts DataSetMetrics or defaults to an empty array.

          // Filters the logs to include only those from the currently selected year and month.
          const filteredLogs = allLogs.filter((row: DataSetMetric) => {
            const logDate = new Date(row.last_time_logged ?? 0);
            return (
              logDate.getFullYear() === this.actualYear &&
              logDate.getMonth() === this.actualMonth
            );
          });

          this.allLogs = filteredLogs; // Stores the filtered logs.
          this.updateChart(filteredLogs); // Updates the chart with the filtered data.
        },
        error => {
          log.error('Error fetching data', error);
          this.errorMsg.set('Failed to load data.');
          this.loading.set(false);
        });
  }

  // Updates or creates the Chart.js graph based on the provided usage metrics.
  private updateChart(logs: DataSetMetric[]) {
    // Calculates the number of days in the currently selected month.
    const daysInMonth = new Date(this.actualYear, this.actualMonth + 1, 0).getDate();

    // Initializes arrays to store daily sums of successful gets and number of users.
    const dailySuccessGets = Array(daysInMonth).fill(0);
    const dailyNumberUsers = Array(daysInMonth).fill(0);

    // Iterates through the logs to aggregate data by day.
    logs.forEach(log => {
      const date = new Date(log.last_time_logged ?? 0);
      const dayIndex = date.getDate() - 1; // Converts day of month to a 0-indexed array index.

      dailySuccessGets[dayIndex] += log.success_get || 0;
      dailyNumberUsers[dayIndex] += log.number_users || 0;
    });

    // Calculates the daily successful gets, ensuring it's 0 if there are no users for that day.
    const dailyCalculatedMetrics = dailySuccessGets.map((totalSuccess, index) => {
      const totalUsers = dailyNumberUsers[index];
      return totalUsers > 0 ? totalSuccess : 0;
    })

    // Creates labels for the x-axis (days of the month).
    const labels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`);

    // Defines the configuration for the bar chart.
    const config: ChartConfiguration<'bar'> = {
      type: 'bar', // Specifies a bar chart.
      data: {
        labels, // X-axis labels (days).
        datasets: [{
          // Label for the dataset, including the formatted month and year.
          label: `Successful Gets (${this.datePipe.transform(new Date(this.actualYear, this.actualMonth), 'MMMM, yyyy')})`,
          data: dailyCalculatedMetrics, // The data points for the bars.
          backgroundColor: 'rgba(153, 102, 255, 0.6)', // Color of the bars.
          borderColor: 'rgba(153, 102, 255, 1)',     // Border color of the bars.
          borderWidth: 1                           // Width of the bar borders.
        }]
      },
      options: {
        responsive: true,           // Makes the chart responsive to container size changes.
        maintainAspectRatio: false, // Allows the chart to not maintain its aspect ratio.
        scales: {
          x: {
            title: {
              display: true,     // Displays the x-axis title.
              text: 'Day of Month', // Text for the x-axis title.
              color: '#475569'   // Color of the x-axis title.
            },
            ticks: {
              color: '#475569'   // Color of the x-axis tick labels.
            }
          },
          y: {
            beginAtZero: true,   // Ensures the y-axis starts at zero.
            title: {
              display: true,     // Displays the y-axis title.
              text: 'Successful Gets', // Text for the y-axis title.
              color: '#475569'   // Color of the y-axis title.
            },
            ticks: {
              color: '#475569'   // Color of the y-axis tick labels.
            }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              // Customizes the tooltip label format.
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y != null) {
                  label += context.parsed.y.toFixed(2); // Formats the y-value in the tooltip.
                }
                return label;
              }
            }
          },
          legend: {
            labels: {
              color: '#475569'   // Color of the legend text.
            }
          }
        }
      }
    };

    const canvas = this.chartCanvas()?.nativeElement;
    if (canvas) {
      if (this.chart) this.chart.destroy(); // Destroys any existing chart instance before creating a new one.
      this.chart = new Chart(canvas, config); // Creates a new Chart.js chart.
    } else {
      log.error('Chart canvas element not found');
    }
  }
}
