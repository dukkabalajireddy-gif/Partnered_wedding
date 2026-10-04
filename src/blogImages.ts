// Photos for the blog pages. All are freely licensed pictures from Wikimedia Commons; each carries its credit.
export interface BlogImage { src: string; small: string; credit: string; page: string; title: string; }
export const BLOG_IMAGES: Record<string, BlogImage> = {
  "udaipur": {
    "src": "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e9/20191207_City_Palace%2C_Mohan_Temple_and_Lake_Pichola%2C_Udaipur%2C_1523_7262.jpg/960px-20191207_City_Palace%2C_Mohan_Temple_and_Lake_Pichola%2C_Udaipur%2C_1523_7262.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "small": "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e9/20191207_City_Palace%2C_Mohan_Temple_and_Lake_Pichola%2C_Udaipur%2C_1523_7262.jpg/500px-20191207_City_Palace%2C_Mohan_Temple_and_Lake_Pichola%2C_Udaipur%2C_1523_7262.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "credit": "Jakub Hałun, CC BY-SA 4.0",
    "page": "https://commons.wikimedia.org/wiki/File:20191207_City_Palace,_Mohan_Temple_and_Lake_Pichola,_Udaipur,_1523_7262.jpg",
    "title": "20191207 City Palace, Mohan Temple and Lake Pichola, Udaipur, 1523 7262.jpg"
  },
  "jaipur": {
    "src": "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/da/20191218_Jaigarh_Fort%2C_Amer%2C_Jaipur%2C_1613_9406.jpg/960px-20191218_Jaigarh_Fort%2C_Amer%2C_Jaipur%2C_1613_9406.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "small": "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/da/20191218_Jaigarh_Fort%2C_Amer%2C_Jaipur%2C_1613_9406.jpg/500px-20191218_Jaigarh_Fort%2C_Amer%2C_Jaipur%2C_1613_9406.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "credit": "Jakub Hałun, CC BY-SA 4.0",
    "page": "https://commons.wikimedia.org/wiki/File:20191218_Jaigarh_Fort,_Amer,_Jaipur,_1613_9406.jpg",
    "title": "20191218 Jaigarh Fort, Amer, Jaipur, 1613 9406.jpg"
  },
  "jodhpur": {
    "src": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/23/20191210_Mehrangarh_Fort%2C_Jodhpur_1016_7834.jpg/960px-20191210_Mehrangarh_Fort%2C_Jodhpur_1016_7834.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "small": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/23/20191210_Mehrangarh_Fort%2C_Jodhpur_1016_7834.jpg/500px-20191210_Mehrangarh_Fort%2C_Jodhpur_1016_7834.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "credit": "Jakub Hałun, CC BY-SA 4.0",
    "page": "https://commons.wikimedia.org/wiki/File:20191210_Mehrangarh_Fort,_Jodhpur_1016_7834.jpg",
    "title": "20191210 Mehrangarh Fort, Jodhpur 1016 7834.jpg"
  },
  "jaisalmer": {
    "src": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5e/Jaisalmer_Fort%2C_India.jpg/960px-Jaisalmer_Fort%2C_India.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "small": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5e/Jaisalmer_Fort%2C_India.jpg/500px-Jaisalmer_Fort%2C_India.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "credit": "Clément Bardot, CC BY-SA 4.0",
    "page": "https://commons.wikimedia.org/wiki/File:Jaisalmer_Fort,_India.jpg",
    "title": "Jaisalmer Fort, India.jpg"
  },
  "goa": {
    "src": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/40/Beach_tress.jpg/960px-Beach_tress.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "small": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/40/Beach_tress.jpg/500px-Beach_tress.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "credit": "Ramakanth15, CC BY-SA 4.0",
    "page": "https://commons.wikimedia.org/wiki/File:Beach_tress.jpg",
    "title": "Beach tress.jpg"
  },
  "alleppey": {
    "src": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/20/Alleppey_Backwaters_%2815865677189%29.jpg/960px-Alleppey_Backwaters_%2815865677189%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "small": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/20/Alleppey_Backwaters_%2815865677189%29.jpg/500px-Alleppey_Backwaters_%2815865677189%29.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "credit": "Dumphasizer, CC BY-SA 2.0",
    "page": "https://commons.wikimedia.org/wiki/File:Alleppey_Backwaters_(15865677189).jpg",
    "title": "Alleppey Backwaters (15865677189).jpg"
  },
  "rishikesh": {
    "src": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7e/Laxman_Jhula_Bridge.jpg/960px-Laxman_Jhula_Bridge.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "small": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7e/Laxman_Jhula_Bridge.jpg/500px-Laxman_Jhula_Bridge.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "credit": "Dey.sandip, CC BY-SA 4.0",
    "page": "https://commons.wikimedia.org/wiki/File:Laxman_Jhula_Bridge.jpg",
    "title": "Laxman Jhula Bridge.jpg"
  },
  "mussoorie": {
    "src": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0c/Mussoorie_the_nature_walk.jpg/960px-Mussoorie_the_nature_walk.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "small": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0c/Mussoorie_the_nature_walk.jpg/500px-Mussoorie_the_nature_walk.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "credit": "Vishaldkapoor, CC BY-SA 4.0",
    "page": "https://commons.wikimedia.org/wiki/File:Mussoorie_the_nature_walk.jpg",
    "title": "Mussoorie the nature walk.jpg"
  },
  "hyderabad": {
    "src": "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d1/Charminar-Pride_of_Hyderabad.jpg/960px-Charminar-Pride_of_Hyderabad.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "small": "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d1/Charminar-Pride_of_Hyderabad.jpg/500px-Charminar-Pride_of_Hyderabad.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "credit": "Gopikrishna Narla, CC BY-SA 3.0",
    "page": "https://commons.wikimedia.org/wiki/File:Charminar-Pride_of_Hyderabad.jpg",
    "title": "Charminar-Pride of Hyderabad.jpg"
  },
  "kochi": {
    "src": "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f2/Chinese_Fishing_Nets_-_3.jpg/960px-Chinese_Fishing_Nets_-_3.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "small": "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f2/Chinese_Fishing_Nets_-_3.jpg/500px-Chinese_Fishing_Nets_-_3.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "credit": "Ingo Mehling, CC BY-SA 4.0",
    "page": "https://commons.wikimedia.org/wiki/File:Chinese_Fishing_Nets_-_3.jpg",
    "title": "Chinese Fishing Nets - 3.jpg"
  },
  "industry": {
    "src": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c0/Indian_Wedding_Mandap_Decoration.jpg/960px-Indian_Wedding_Mandap_Decoration.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "small": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c0/Indian_Wedding_Mandap_Decoration.jpg/500px-Indian_Wedding_Mandap_Decoration.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "credit": "Wikilover90, CC BY-SA 4.0",
    "page": "https://commons.wikimedia.org/wiki/File:Indian_Wedding_Mandap_Decoration.jpg",
    "title": "Indian Wedding Mandap Decoration.jpg"
  },
  "celebrity": {
    "src": "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ae/KANGNA_CEREMONY.jpg/960px-KANGNA_CEREMONY.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "small": "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ae/KANGNA_CEREMONY.jpg/500px-KANGNA_CEREMONY.jpg?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail",
    "credit": "Goyalpuneet, CC BY-SA 4.0",
    "page": "https://commons.wikimedia.org/wiki/File:KANGNA_CEREMONY.jpg",
    "title": "KANGNA CEREMONY.jpg"
  }
};
