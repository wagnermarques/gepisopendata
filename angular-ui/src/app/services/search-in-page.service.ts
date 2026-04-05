import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SearchInPageService {
  isOpen = signal(false);
  searchText = signal('');

  open() {
    this.isOpen.set(true);
  }

  close() {
    this.isOpen.set(false);
    this.searchText.set('');
  }

  toggle() {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  findNext(text: string) {
    // window.find(text, caseSensitive, backwards, wrapAround, wholeWord, searchInFrames, showDialog)
    // @ts-ignore - window.find is a non-standard but widely supported API
    window.find(text, false, false, true, false, false, false);
  }

  findPrev(text: string) {
    // @ts-ignore
    window.find(text, false, true, true, false, false, false);
  }
}
