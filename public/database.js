/* database.js - v8 (Kiosk Edition) */

const LibraryDB = {
    key: 'library_books_v8', // New key
    
    genreMaps: {
        'Fiction': 'https://placehold.co/600x400/ffc4d6/0b1121?text=Fiction+Section',
        'Non-Fiction': 'https://placehold.co/600x400/c4b5fd/0b1121?text=Non-Fiction',
        'Romance': 'https://placehold.co/600x400/f9a8d4/0b1121?text=Romance',
        'Science': 'https://placehold.co/600x400/93c5fd/0b1121?text=Science',
        'History': 'https://placehold.co/600x400/d8b4fe/0b1121?text=History'
    },
    
    defaultBooks: [
        { id: 1, title: "The Great Gatsby", author: "F. Scott Fitzgerald", genre: "Fiction", shelf: "A-12" },
        { id: 8, title: "To Kill a Mockingbird", author: "Harper Lee", genre: "Fiction", shelf: "A-12" },
        { id: 5, title: "1984", author: "George Orwell", genre: "Fiction", shelf: "A-15" },
        { id: 9, title: "The Catcher in the Rye", author: "J.D. Salinger", genre: "Fiction", shelf: "A-15" },
        { id: 14, title: "The Hobbit", author: "J.R.R. Tolkien", genre: "Fiction", shelf: "A-10" },
        { id: 15, title: "The Lord of the Rings", author: "J.R.R. Tolkien", genre: "Fiction", shelf: "A-10" },
        { id: 2, title: "Sapiens", author: "Yuval Noah Harari", genre: "Non-Fiction", shelf: "B-04" },
        { id: 12, title: "Educated", author: "Tara Westover", genre: "Non-Fiction", shelf: "B-04" },
        { id: 6, title: "Becoming", author: "Michelle Obama", genre: "Non-Fiction", shelf: "B-11" },
        { id: 16, title: "Atomic Habits", author: "James Clear", genre: "Non-Fiction", shelf: "B-11" },
        { id: 3, title: "Pride and Prejudice", author: "Jane Austen", genre: "Romance", shelf: "C-01" },
        { id: 11, title: "The Notebook", author: "Nicholas Sparks", genre: "Romance", shelf: "C-01" },
        { id: 17, title: "Romeo and Juliet", author: "William Shakespeare", genre: "Romance", shelf: "C-05" },
        { id: 18, title: "Little Women", author: "Louisa May Alcott", genre: "Romance", shelf: "C-05" },
        { id: 4, title: "A Brief History of Time", author: "Stephen Hawking", genre: "Science", shelf: "D-09" },
        { id: 10, title: "Silent Spring", author: "Rachel Carson", genre: "Science", shelf: "D-09" },
        { id: 7, title: "Dune", author: "Frank Herbert", genre: "Science", shelf: "D-02" },
        { id: 13, title: "Cosmos", author: "Carl Sagan", genre: "Science", shelf: "D-02" },
        { id: 19, title: "Guns, Germs, and Steel", author: "Jared Diamond", genre: "History", shelf: "E-01" },
        { id: 20, title: "The Diary of a Young Girl", author: "Anne Frank", genre: "History", shelf: "E-01" }
    ],
    
    init: function() {
        if (!localStorage.getItem(this.key)) {
            localStorage.setItem(this.key, JSON.stringify(this.defaultBooks));
        }
    },
    
    getBooks: function() {
        this.init();
        return JSON.parse(localStorage.getItem(this.key));
    },
    
    getMapUrl: function(genre) {
        return this.genreMaps[genre] || 'https://placehold.co/600x400/gray/white?text=General+Section';
    }
};

LibraryDB.init();
