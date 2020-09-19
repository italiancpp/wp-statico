#!/usr/bin/python3.6

import sys
import os

def read_parameters():
	return os.path.abspath(sys.argv[1]), sys.argv[2], sys.argv[3]
	
def determine_depth(file_path):
	return file_path.count('/')

def crawl_files(root_folder, search_url, replace_url):
	base_depth = determine_depth(root_folder)
	
	count_replacements = 0
	for subdir, dirs, files in os.walk(root_folder):
		for file in files:
			if file.endswith("html"):
				file_path = os.path.join(subdir, file)
				depth_below_root = determine_depth(file_path) - base_depth
				
				print (file_path + " -- " + str(depth_below_root))
				count_replacements +=scan_replace(search_url, replace_url, file_path, depth_below_root)
	print (str(count_replacements) + " sostituzioni")
			
def scan_replace(search_url, replace_url, file_path, depth_below_root):
	web_page = open(file_path, "r")
	text = web_page.read()
	
	if search_url in text:
		print ("Found in " + str(file_path))
		
		relative_prefix = "../" * (depth_below_root -1)
		text = text.replace(search_url, relative_prefix + replace_url)
		
		web_page.close()
		web_page = open(file_path, "w")
		web_page.write(text)
		web_page.close()
		
		return 1
		
	return 0



if __name__ == "__main__":
	root_folder, search_url, replace_url = read_parameters()
	print("Running in " + root_folder)
	crawl_files(root_folder, search_url, replace_url)