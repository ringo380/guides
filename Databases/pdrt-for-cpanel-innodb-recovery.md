# Using Percona Data Recovery Tools for InnoDB in a cPanel Environment

> ☢️ **WARNING**:
>
> IF YOU HAVE IDENTIFIED DATA LOSS ON YOUR SERVER, PLEASE SKIP TO STEPS IN THE "FIRST RESPONSE" SECTION AS SOON AS POSSIBLE (THIS MAY BE TIME-SENSITIVE)

Percona provides a set of tools for recovering lost or corrupted MySQL data from InnoDB's data files. These tools are freely available, and with some setup, can be useful in retrieving data that may have otherwise been lost permanently, or in recovering from InnoDB corruption.

Percona documents these examples of where this tool may be the most helpful:

   * A mistaken DROP TABLE, DELETE, TRUNCATE, or UPDATE
   * Deletion of the data file on the filesystem level
   * Partial corruption of the data such that InnoDB is unable to run without crashing, even with innodb_force_recovery set

_____________________________________________
## THE TOOLS

As mentioned earlier - if you're encountering a situation where you'll need to perform recovery, go ahead and skip to the next section and get the preparation started, then come back here once you've got your files backed up. The longer that MySQL is online and able to write to your existing ibdata and table files, the more chance there is that lost or corrupted data will be irrecoverable.

To provide you with a reference point on the tools you'll be using, I'm going to include the usage information here, so that you can become familiar with what kind of options you'll have with the various utilities involved:
```
=constraints_parser=
    Usage: ./constraints_parser -4|-5|-6 [-dDV] -f &lt;InnoDB page or dir&gt; [-T N:M] [-b &lt;external pages directory&gt;]
	  Where options are:
	    -f &lt;InnoDB page(s)&gt; -- InnoDB page or directory with pages
	    -o &lt;file&gt; -- Save dump in this file. Otherwise print to stdout
	    -h  -- Print this help
	    -d  -- Process only those pages which potentially could have deleted records (default = NO)
	    -D  -- Recover deleted rows only (default = NO)
	    -U  -- Recover UNdeleted rows only (default = YES)
	    -V  -- Verbose mode (lots of debug information)
	    -4  -- innodb_datafile is in REDUNDANT format
	    -5  -- innodb_datafile is in COMPACT format
	    -6  -- innodb_datafile is in MySQL 5.6 format
	    -T  -- retrieves only pages with index id = NM (N - high word, M - low word of id)
	    -b &lt;dir&gt; -- Directory where external pages can be found. Usually it is pages-XXX/FIL_PAGE_TYPE_BLOB/
	    -p prefix -- Use prefix for a directory name in LOAD DATA INFILE command

[[create_defs.pl]]
	Usage: create_defs.pl [options]
	  Where options are:
		--host     - mysql host
		--port     - mysql port
		--user     - mysql username
		--password - mysql password
		--db       - mysql database
		--table    - specific table only
		--help     - show this help

[[page_parser]]
	Usage: ./page_parser -4|-5 [-dDhcCV] -f &lt;innodb_datafile&gt; [-T N:M] [-s size] [-t size]
	  Where
	    -h  -- Print this help
	    -V  -- Print debug information
	    -d  -- Process only those pages which potentially could have deleted records (default = NO)
	    -s size -- Amount of memory used for disk cache (allowed examples 1G 10M). Default 100M
	    -T  -- retrieves only pages with index id = NM (N - high word, M - low word of id)
	    -c  -- count pages in the tablespace and group them by index id
	    -C  -- count pages in the tablespace and group them by index id (and ignore too high/zero indexes)
	    -t  size -- Size of InnoDB tablespace to scan. Use it only if the parser can't determine it by himself.
```

```quiz
question: "What does the constraints_parser tool from PDRT (Percona Data Recovery Tool) do?"
type: multiple-choice
options:
  - text: "It repairs the InnoDB tablespace file in place"
    feedback: "constraints_parser doesn't repair files. It extracts data from them by scanning for valid row patterns."
  - text: "It scans InnoDB data files and extracts rows matching a defined table structure"
    correct: true
    feedback: "Correct! constraints_parser reads the raw InnoDB tablespace files (ibdata1 or .ibd files) and uses a table definition file to identify and extract valid rows. It can recover data even from severely corrupted tablespaces where MySQL itself can't start."
  - text: "It checks foreign key constraints and removes invalid references"
    feedback: "Despite the name, constraints_parser doesn't manage foreign keys. It uses 'constraints' (column definitions) to identify and extract row data from raw InnoDB pages."
  - text: "It converts InnoDB tables to MyISAM format for easier recovery"
    feedback: "constraints_parser doesn't convert formats. It extracts raw data from InnoDB files into tab-separated output that can be imported into a new database."
```

_____________________________________________
## FIRST RESPONSE

There are a few steps that are recommended to ensure that you react appropriately to an InnoDB data loss situation. Every person's data-loss scenario is going to differ, but for the most part I'm going to approach this from the perspective of someone who has immediately recognized and identified the data loss at the time that it occurs, and is seeking to recover that lost data. While not the only relevant scenario when it comes to InnoDB data loss, it is the most feasible when considering the use of PDRT for recovery purposes.

When approaching data recovery using PDRT, it's a good idea to understand that - as more time passes after the data has been lost - you'll be increasingly less likely to recover everything that you've lost, and after a certain point, it can be lost permanently (save for further advanced/physical file system recovery methods, but that's something entirely diferent). With that in mind, it's critical to move quickly.

If you've recognized that data loss has occurred, you should do the following:

1. If still running, go ahead and STOP the MySQL server as soon as possible:
```
	# /etc/init.d/mysql stop
```
The idea here is to prevent new writes occupying space in the data files that may replace some of the data that you're looking to recover. Because it's "deleted", it's at risk of being overwritten, and won't stick around for long.

2. Backup your InnoDB data files:
```
	# mkdir /root/innodb.bak (or backup path of your choice)
	# cd /var/lib/mysql
	# dd if=ibdata1 of=ibdata1.recovery conv=noerror
	# cp ./ib* /root/innodb.bak/
```
First, you're making a directory to place any file copies in, then you're creating another copy of the ibdata file to work with. This allows us to start the MySQL server again without worrying about new writes occurring and overwriting old data. I like to make sure a copy of the recovery file exists in innodb.bak, as well.

3. Backup your InnoDB database folder (replace $db_name with the database name in question):
```
	# cd /var/lib/mysql
	# cp -R ./$db_name /root/innodb.bak/
```
This ensures that you maintain copies of any form and table files that are still present at that time. Because all cPanel servers default to using "innodb_file_per_table=1" in the my.cnf file, these files exist, and it generally makes life a little bit easier in terms of recovery, because you won't usually have to deal with splitting the data file into pages and tracking down indices.

The downside to this, however, is that dropping a table results in the frm/ibd files being removed altogether, without dealing with the ibdata file. What this means is that you won't be able to recover that data directly from the ibdata file, like you'd recover corrupted data or deleted rows from an existing table. It will more than likely require physical file recovery methods to be utilized.

4. At this point, it is safe to bring MySQL back online, if you are able to. If you can bring it online, let's go ahead and start the MySQL service, then perform a mysqldump - I'd recommend the following (you can dump these to another path other than /root, if you'd prefer - just remember what you choose):
```
	# mysqldump --single-transaction --all-databases &gt; /root/dump_wtrans.sql
	# mysqldump --all-databases &gt; /root/dump.sql
```
Dumping it with single-transaction flag creates the dump in, go figure, a single transaction, which prevents locking on the database, and may help if you're running a 100% InnoDB environment - so to be safe, particularly if you're not sure, I recommend running both.

Note: If you're dealing with file system corruption, try and back up these files on to another disk drive, if available (or even to a secure, remote host, if viable).

```quiz
question: "What should be your first action when discovering a corrupted InnoDB database?"
type: multiple-choice
options:
  - text: "Immediately run mysqlcheck --repair on all databases"
    feedback: "mysqlcheck --repair works for MyISAM tables. For InnoDB corruption, running repair commands without preparation can make things worse."
  - text: "Stop MySQL and make a full copy of the data directory before attempting any recovery"
    correct: true
    feedback: "Correct! Always preserve the original data before any recovery attempt. Copy the entire MySQL data directory (especially ibdata1, ib_logfile*, and the database directories). Recovery tools modify data in place, so without a backup, a failed recovery attempt can destroy your only copy."
  - text: "Delete the ib_logfile files and restart MySQL"
    feedback: "Deleting InnoDB log files without understanding the state can cause data loss. The logs may contain uncommitted transactions needed for recovery."
  - text: "Restore from the most recent backup immediately"
    feedback: "Restoring from backup is often the best path, but first you should preserve the current data directory. The backup might be outdated, and you may need the current files for recovering recent data."
```

_____________________________________________
## ASSESSING THE SITUATION:

Alright - you've got your important files backed up, so the real time-crunch is past us now. We can relax a little and plan out the next course of action. First, let's get an idea of what we're dealing with:

1. What is the severity of the data loss?

    * Deleted a few rows? You're in luck, and will likely be able to recover this if you caught in time.

	* Truncated a table? Not so bad, you should be able to recover some, if not all of this, depending on how much time passed before the MySQL server was stopped.

	* Widespread corruption? You might be surprised that this is actually a fairly recoverable scenario, and you can sometimes use these tools to effectively recover from situations that innodb_force_recovery won't resolve.

	* Deleted a table? This is probably the most difficult situation on a cPanel environment, because of the files being stored independently with "innodb_file_per_table" set to 1 by default. If you've got any pre-existing copies or backups to reference, you may still be alright, though.

2. Do you have other backups of your databases or database files (other than the ones you just made)?

	* If so, that's a huge help, particularly if the structure is still the same. The goal is to try and re-create the table structures as closely as possible to make identification of relevant data easy, so being able to reference an old copy is very helpful.

	* If not, that's alright. If the MySQL server isn't crashing, and you're still able to access the table, then you can easily look at its create table statement by running (replace $table_name with the table name):

		`mysql&gt; show create table $table_name;`

	I'll cover this to a greater extent later on in the article. If MySQL is not running at this point, you'll want to try and track down a copy of the table structure, the table create statement, or a backup of some kind - anything that can give you an idea of what that table's layout was like.

3. What version of MySQL is your server currently running?

	* Run "`mysql -V`" to confirm this. Note whether it's 4.x or 5.x - this will be important later on.

_____________________________________________

```quiz
question: "What is the relationship between ibdata1 and .ibd files in InnoDB?"
type: multiple-choice
options:
  - text: "ibdata1 is the main data file; .ibd files are backup copies"
    feedback: ".ibd files aren't backups. They're the per-table data files used when innodb_file_per_table is enabled."
  - text: "ibdata1 is the system tablespace (metadata, undo logs); .ibd files store individual table data when file-per-table is enabled"
    correct: true
    feedback: "Correct! With innodb_file_per_table=ON (default since MySQL 5.6), each table gets its own .ibd file for data and indexes. ibdata1 always exists and contains the system tablespace (data dictionary, undo logs, change buffer). Without file-per-table, all table data lives in ibdata1."
  - text: "ibdata1 stores indexes; .ibd files store row data"
    feedback: "Both ibdata1 and .ibd files can contain both data and indexes. The split depends on whether file-per-table is enabled, not on data type."
  - text: ".ibd files are only used by Percona Server, not standard MySQL"
    feedback: ".ibd files are standard InnoDB (both MySQL and Percona). They're created when innodb_file_per_table is enabled, which is the default in modern MySQL."
```

## PREPARING YOUR SERVER FOR RECOVERY USING PDRT:

After you've assessed the status of the situation, you can start getting the server prepared for the actual recovery procedures. Let's get all of the tools ready, and make sure the server's ready to move forward. Because the development build includes an effective set of tools that aren't in the current stable release, I'm going to recommend going ahead and downloading their latest build via Bazaar.

1. If you don't already have Bazaar installed, you can do so by running "yum install bzr", or by downloading and installing from their site: http://wiki.bazaar.canonical.com/Download

2. Go ahead and download the Percona recovery tools - you can do this in any viable folder that you'd like, but for this example I'll be installing into /root (download URL current as of time of writing this, but may change with new version releases down the road):
```
	# cd /root
	# bzr branch lp:percona-data-recovery-tool-for-innodb
```
You should see something like this, if successful (you can ignore the "launchpad ID" warning):
```
	You have not informed bzr of your Launchpad ID, and you must do this to
	write to Launchpad or access private data.  See "bzr help launchpad-login".
	Branched 81 revision(s).
```
The installation now exists in /root/percona-data-recovery-tool-for-innodb.. but for the purposes of this example, and ease of access, I'm going to shorten that down a little:
```
	# mv percona-data-recovery-tool-for-innodb pdrt
```
3. Perform the initial tools install/compile, running the "configure" command from within the mysql-source subdirectory, and the "make" command from the parent folder that was extracted into /root (percona-data-recovery-tool-for-innodb-0.5 in this case):
```
	# cd /root/pdrt/mysql-source
	# ./configure

	# cd ..
	# make
```
4. Because you've got a copy of the important data files already ready to go, you can go ahead and bring the MySQL service back online, if it still successfully starts:
```
	# /etc/init.d/mysql start
```
5. Check whether you've already got the DBD::mysql perl module installed or not (it is not installed by default on most cPanel installations) - this may be needed for recovery scripts later on, depending on the outcome:
```
	# perl -MDBD::mysql -e 1
```
If it's successfully installed, you should get no output returned. However, if the output looks something like this:
```
	Can't locate DBD/mysql.pm in @INC (@INC contains: /usr/local/lib64/perl5 /usr/local/share/perl5 /usr/lib64/perl5/vendor_perl /usr/share/perl5/vendor_perl /usr/lib64/perl5 /usr/share/perl5 .).
	BEGIN failed--compilation aborted.
```
Then you'll need to install DBD::mysql using the following cPanel perl module installation script:
```
	# /scripts/perlinstaller DBD::mysql
```
_____________________________________________
## GETTING YOUR DATA STRUCTURE:

You've generally got two circumstances here. One being a MySQL service that will functionally start, with or without innodb_force_recovery, and is accessible. The second being a MySQL service that is failing to even start, as a result of the corruption/data issues. I'll cover what the options and procedures are for both of these:

### IF MYSQL IS RUNNING

1. Recovery Database

Create a new database dedicated to recovery (name isn't important, as long as you know what it is - I usually just use the original database name with _recovered tacked on the end):
```
	# mysql -e "CREATE DATABASE database_recovered"
```
2. Getting the table structure

If the table you're attempting to recover data on still exists, you can get its full CREATE TABLE statement (if you did not already get this in one of the earlier steps) for re-creating the table structure by running (replace table and database names accordingly - the database name you're looking for here is going to be the corrupted, original database, not the recovery db you created):
```
	# mysql -NBE -e "SHOW CREATE TABLE table_name" database_name
```
The output will look something like this, using the customer table from the official MySQL Sakila database as an example:
```
	*************************** 1. row ***************************
	customer
	CREATE TABLE `customer` (
	  `customer_id` smallint(5) unsigned NOT NULL AUTO_INCREMENT,
	  `store_id` tinyint(3) unsigned NOT NULL,
	  `first_name` varchar(45) NOT NULL,
	  `last_name` varchar(45) NOT NULL,
	  `email` varchar(50) DEFAULT NULL,
	  `address_id` smallint(5) unsigned NOT NULL,
	  `active` tinyint(1) NOT NULL DEFAULT '1',
	  `create_date` datetime NOT NULL,
	  `last_update` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	  PRIMARY KEY (`customer_id`),
	  KEY `idx_fk_store_id` (`store_id`),
	  KEY `idx_fk_address_id` (`address_id`),
	  KEY `idx_last_name` (`last_name`),
	  CONSTRAINT `fk_customer_address` FOREIGN KEY (`address_id`) REFERENCES `address` (`address_id`) ON UPDATE CASCADE,
	  CONSTRAINT `fk_customer_store` FOREIGN KEY (`store_id`) REFERENCES `store` (`store_id`) ON UPDATE CASCADE
	) ENGINE=InnoDB DEFAULT CHARSET=utf8
```
You'll want to copy everything from "CREATE" to "utf8" - put it in a text editor or another shell just to hang on to it for the time being. If you're looking to restore all the tables on a database, you'll want to make sure and get the table structure for each table involved.

3. Re-creating the Tables

Take that CREATE TABLE statement, and use it to make the table(s) within your recovery database (be sure to add a semi-colon at the end to terminate the statement properly). Eg:
```
	# mysql mydb_recovered
	mysql&gt; SET foreign_key_checks=0;
	Query OK, 0 rows affected (0.01 sec)
	mysql&gt; CREATE TABLE `customer` (
	  `customer_id` smallint(5) unsigned NOT NULL AUTO_INCREMENT,
	  `store_id` tinyint(3) unsigned NOT NULL,
	  `first_name` varchar(45) NOT NULL,
	  `last_name` varchar(45) NOT NULL,
	  `email` varchar(50) DEFAULT NULL,
	  `address_id` smallint(5) unsigned NOT NULL,
	  `active` tinyint(1) NOT NULL DEFAULT '1',
	  `create_date` datetime NOT NULL,
	  `last_update` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	  PRIMARY KEY (`customer_id`),
	  KEY `idx_fk_store_id` (`store_id`),
	  KEY `idx_fk_address_id` (`address_id`),
	  KEY `idx_last_name` (`last_name`),
	  CONSTRAINT `fk_customer_address` FOREIGN KEY (`address_id`) REFERENCES `address` (`address_id`) ON UPDATE CASCADE,
	  CONSTRAINT `fk_customer_store` FOREIGN KEY (`store_id`) REFERENCES `store` (`store_id`) ON UPDATE CASCADE
	) ENGINE=InnoDB DEFAULT CHARSET=utf8;
	Query OK, 0 rows affected (0.02 sec)
```
Take note of the "`SET foreign_key_checks=0;`" statement at the beginning. This will generally be necessary to allow the full create table statement to be executed.

### IF MYSQL IS NOT RUNNING & REFUSES TO START

1. Innodb_force_recovery Method

If you haven't already, try bringing it online using innodb_force_recovery in the my.cnf file ( http://dev.mysql.com/doc/refman/5.0/en/forcing-innodb-recovery.html ). You can either try increasing it from a value of 1, up to 6 in increments until you find the value that allows MySQL to start, or you can jump right to 6 if you'd prefer. The goal is just to get MySQL in a somewhat operational state. If none of these values work, move on to step 2..

2. Resetting the ib* files

As a last ditch to get MySQL running, move the ibdata and ib_log* files out of the way so that MySQL can simply re-create fresh ones:
```
	# cd /var/lib/mysql
	# mv ibdata1 ibdata1.bak
	# mv ib_logfile0 ib_logfile0.bak
	# mv ib_logfile1 ib_logfile1.bak
	# service mysqld start
```
3. SQL Dumps

Once MySQL is successfully running, either via innodb_force_recovery or renaming the ib* files, go ahead and get a couple of MySQL dumps. The data that you'll get as a result may not be much, depending on whether you're running a pure InnoDB environment, or if you've got MyISAM tables as well, but it's a good idea to go ahead and have dumps made regardless:
```
	# mysqldump --single-transaction --all-databases &gt; /root/sqldump_trans.sql
	# mysqldump --all-databases &gt; /root/sqldump.sql
```
4. Recovery Database

At this point, with MySQL up and running, go ahead and create your recovery database:
```
	# mysql -e "CREATE DATABASE recovery"
```
5. Getting the CREATE TABLE Statement

You still want to try and get the table structure if at all possible, so if you are still able to access the database you're recovering from, and the table exists within it, go ahead and perform the "SHOW CREATE TABLE" procedure described starting at Step 2 of the "IF MYSQL IS RUNNING" section. However, if for any reason you can't get that create table statement directly from within MySQL, there is another way, if you've got the table.frm file available (if the table was dropped entirely, you're out of luck here, unfortunately, assuming that innodb_file_per_table is enabled in my.cnf). To restore the CREATE TABLE statement from the .frm file, one easy way is to do the following:
```
	* Log into another MySQL instance, either one that you've set up parallel, or ideally within a quick sandbox environment or VM.
	* In any database - again ideally one specifically created for this purpose to minimize risk - create a table by the same name of the one you've got the frm file for.
	* Stop the MySQL server
	* Overwrite the frm file in the data directory with the frm file you've copied from your original MySQL server or server backup.
	* Start the MySQL server again, log into it, and perform the SHOW CREATE TABLE STATEMENT (quick command: mysql -NBE -e "SHOW CREATE TABLE table_name" database_name)
```
Alternatively, MySQL has a utility that can be used to attempt to extract table structure from .frm files, which can be found here:

> http://dev.mysql.com/downloads/utilities/

_____________________________________________
## RECOVERING YOUR DATA

So at this point, regardless of your situation, you should at least have your "/var/lib/mysql/ibdata1.recovery" file created (which we'll be working with to recover data from, rather than the active ibdata1), a copy of your schema directory (/var/lib/mysql/dbname/*), a functional, running MySQL server that accepts queries, and at least one new database created containing table structures for each of the tables you'd to recover data for (if you want to look for data from all tables in a database, for example, go ahead and create the table structures for each table within the database before proceeding).

There's a few different paths you can take here, depending on what kind of recovery you're attempting. I'll try and cover some of the options for each:

### RECOVERING DELETED DATA WITHIN AN EXISTING TABLE

1. Automated Data Recovery

Percona provides a script to automate the use of the existing =constraints_parser= tool on multiple tables in a database - I've modified this a bit to try and improve its coverage, as well as cooperation within a cPanel environment. This tends to be an effective way to get your database back intact, whether you're dealing with a single table or a full set of tables. Download this script to the folder containing the PDRT source (/root/pdrt, if you created the path from these instructions) and execute it on the recovery database:
	```
	# cd /root/pdrt; wget https://raw.githubusercontent.com/ringo380/cpscripts/master/cprec-tables.sh && chmod +x cprec-tables.sh
	# sh cprec_tables.sh recovery-db
	```
For the purposes of this script, it may make things easier if you've got an up-to-date /root/.my.cnf file, which should contain your current MySQL root credentials. Resetting your MySQL root password within WHM will automatically update/create this if it does not exist. The script should prompt you for the password, though, if this file is not present.

If this script runs successfully, you should see output from the compile processes running, and subsequently a completion notice. You won't see any of the data there yet - it's been output to one file per table, in the directory you're running the script from (which should be the PDRT source folder). The format is: "out.tablename"

2. Start digging!

Depending on the circumstances, these files can have a lot of junk in them. Often, though, data you're looking for will be grouped together in chunks.

In the following example, I had accidentally deleted the "English" row from my language table. I ran the script, which took data from the "ibdata1.recovery" file and extracted it based on the table structures defined in a recovery database, which in this case simply had the "language" table's structure re-created within it. That script produced an "out.language" file in the directory, so I did a quick grep, with "-in" flag to enable case insensitivity, and to display line numbers, for the word "English". I was lucky enough in this case that the data was collected at the very beginning of the file (it will not always be that easy - that's where manually tuning the =table_defs.h= file comes in, which is a bit more advanced):
```
	-bash-4.1# grep -in English out.language
	6:language	1	"English             "	"2006-02-15 11:02:19"
	-bash-4.1# head -20 out.language
	language	2	"Italian             "	"2006-02-15 11:02:19"
	language	3	"Japanese            "	"2006-02-15 11:02:19"
	language	4	"Mandarin            "	"2006-02-15 11:02:19"
	language	5	"French              "	"2006-02-15 11:02:19"
	language	6	"German              "	"2006-02-15 11:02:19"
	language	1	"English             "	"2006-02-15 11:02:19"
	language	2	"Italian             "	"2006-02-15 11:02:19"
	language	3	"Japanese            "	"2006-02-15 11:02:19"
	language	4	"Mandarin            "	"2006-02-15 11:02:19"
	language	5	"French              "	"2006-02-15 11:02:19"
	language	6	"German              "	"2006-02-15 11:02:19"
	language	128	"	"2027-02-25 10:19:07"
	language	128	"	"2038-01-19 05:09:43"
	language	128	"	"1970-01-21 13:13:36"
	language	128	"	"1984-05-28 20:30:58"
	language	128	"	"1983-10-28 16:57:20"
	language	128	"	"1970-01-02 20:56:32"
	language	128	"	"1971-05-01 10:51:02"
	language	128	"	"2042-04-21 15:32:16"
	language	128	"	"1970-01-18 01:36:00"
```

There were three columns in the language table - language_id, name, and last_update. All of which are reflected here, with complete records. The rest of the "out.language" file, however, is filled with "dummy" results, which you'll generally have to sift through to find your actual content.

So there, I was able to see that language_id of the deleted entry is 1, the name is "English" (we can also see that there is character limit of 20 in the "name" column, if you notice the spaces there between the double quotes), as we already knew, and the last updated time was "2006-02-15 11:02:19". Now, we can re-create the deleted row successfully with this data. If this was all you needed, and the procedure was successful, you can consider yourself lucky.

### MANUAL METHOD:

If you think you might be missing something with the automated script method, which many likely will be, you can also run the relevant scripts manually to get the appropriate output. To start, you want to make sure your table definitions are appropriate, by grabbing the structure as it exists in your recovery database, and copying it to the include/=table_defs.h= file. Be sure and run this from within the PDRT source folder (replace database_name and table_name with the name of the RECOVERY database that you created, and the table that you're working with - additionally, this relies on a valid /root/.my.cnf existing, if one does not exist, you will need to replace the command after "--password=" with your actual root MySQL password):
	```
	# DB=database_name; TBL=table_name; perl [[create_defs.pl]] --host=localhost --user=root --password=`grep pass /root/.my.cnf | cut -d= -f2 | sed -e 's/^"//'  -e 's/"$//'` --db=$DB --table=$TBL &gt; include/=table_defs.h=
	```
Then, to make sure that the tools are compiled to use these updated table definitions, you simply re-run the make command from the PDRT source folder:
```
	# cd /root/pdrt && make clean all
```
Now, you can run the =constraints_parser= tool, which will reference the table definitions you've compiled with, and try to track down relevant data within the ibdata1.recovery file in /var/lib/mysql:
```
	# ./=constraints_parser= -5 -f /var/lib/mysql/ibdata1.recovery &gt; table_recovery.out
```
You can also run this without outputting to a file ("&gt; table_recovery.out" in the above command), but there will generally be a substantial amount of information displayed, and it is usually simpler to write it to a file and parse through it afterwards.

```terminal
title: Running constraints_parser for Data Recovery
steps:
  - command: "constraints_parser -5 -f /var/lib/mysql/ibdata1 -t table_defs/users.constraints"
    output: |
      -- Parsing InnoDB tablespace: /var/lib/mysql/ibdata1
      -- Using table definition: table_defs/users.constraints
      -- Page size: 16384 bytes
      -- Scanning pages...
      -- Found 15234 candidate rows
      -- 14891 rows passed all constraints
      -- Output written to dumps/default/users
    narration: "constraints_parser scans the raw tablespace file using the table definition to identify valid rows. -5 means InnoDB page format. 14891 of 15234 candidate rows passed validation - the 343 failures are likely corrupted rows."
  - command: "head -3 dumps/default/users"
    output: |
      1\tJohn\tjohn@example.com\t2024-01-15 10:30:00
      2\tJane\tjane@example.com\t2024-01-15 11:45:00
      3\tBob\tbob@example.com\t2024-01-16 09:00:00
    narration: "Output is tab-separated values matching the table definition columns. This can be loaded into a fresh MySQL table with LOAD DATA INFILE."
  - command: "mysql -e \"LOAD DATA LOCAL INFILE 'dumps/default/users' INTO TABLE users\" mydb"
    output: "Query OK, 14891 rows affected"
    narration: "Import the recovered data into a new, clean database. Verify row counts and spot-check data integrity after import."
```


_____________________________________________
## TWEAKING YOUR TABLE DEFINITIONS

When using PDRT, `=constraints_parser=` is at the core of generating the output that is really going to be the most helpful. How helpful it is, though, will depend on how well you customize your table definitions.

`=constraints_parser=` uses table structure definitions as defined by the `=table_defs.h=` file that we created earlier in the guide, which were then compiled into the application. You've probably noticed, though, that `=constraints_parser=`, when using the generated `=table_defs.h=` file, can produce a lot of garbage output. Something that can really come in handy is the ability to tweak `=table_defs.h=` to really minimize the unrelated data that is produced by `=constraints_parser=`.

I've pulled up the "first_name" column definition from the =table_defs.h=.customer file that was generated, so we can take a look at some practical ways to adjust this for better results:

```
	{ /* varchar(45) */
			name: "first_name",
			type: FT_CHAR,
			min_length: 0,
			max_length: 135,

			has_limits: FALSE,
			limits: {
					can_be_null: FALSE,
					char_min_len: 0,
					char_max_len: 135,
					char_ascii_only: TRUE
			},

			can_be_null: FALSE
	},
```

These definitions act as sort of a mask, and allow the parser script to try and intelligently determine what data is relevant to your tables, and what data is irrelevant, or relevant elsewhere. I chose first_name in this instance because - at least in the "customer" table - it is something that every customer entry likely has, and so it can act as sort of a baseline.

You'll notice, looking through definitions files, that columns will default to "has_limits: FALSE". This means that limitations defined there are not being taken into account when =constraints_parser= searches through page files or data files. These limitations, though, are what are really going to help you weed out the junk and find what you're looking for.

So, focusing just on the first_name definitions, we'll take the same scenario from earlier in the documentation, and see if we have any more luck getting a full set of data using =constraints_parser=. With the auto-generated table definitions, =constraints_parser= was unable to find the MARY SMITH entry. Let's look at some of the simple changes using just the standard set of limitation fields that are already provided for us:
```
	* has_limits: FALSE 	-	This should be our first adjustment. To enable limitations, change this to TRUE.
	* can_be_null: FALSE	-	Every customer entry in the table should have a first name, so we can leave this at FALSE. With has_limits enabled, this will now be in effect, and many of those blank, unrelated entries will be filtered out.
	* char_min_len: 0		-	If you're familiar with your data, you could set this to a number that you know all of your first names will be over. For this example, I'm going to set mine to 2, knowing that none of the first names in the table should have a single character.
	* char_max_len: 135		-	This defaults to the length it sees in the table definitino, which matches "max_length" above the limits section, however you can set this higher or lower if you want to filter your results even further. This can be particularly useful if you're looking for a specific entry. I'm looking specifically for MARY, so, while 4 would make sense, I'm going to set it to 5, just to be sure.
	* char_ascii_only: TRUE	-	This column should indeed be ASCII characters only, so we can leave this one alone.
```
Now, the first_name definitions entry should look something like this:
```
	{ /* varchar(45) */
		name: "first_name",
		type: FT_CHAR,
		min_length: 0,
		max_length: 135,

		has_limits: TRUE,
		limits: {
				can_be_null: FALSE,
				char_min_len: 2,
				char_max_len: 5,
				char_ascii_only: TRUE
		},

		can_be_null: FALSE
	},
```
Those look good, so now we can run make in the PDRT source folder and give constraints_parser another shot. We're going to give the "-D" flag a try as well, which instructs it to specifically look for deleted records:
```
	# cd /root/pdrt && make clean all
	# ./constraints_parser -5 -Df /root/innodb.bak/mydb/customer.ibd
```
The resulting output:
```
	76.92% done
	SET FOREIGN_KEY_CHECKS=0;
	LOAD DATA INFILE '/root/pdrt/dumps/default/customer' REPLACE INTO TABLE `customer` FIELDS TERMINATED BY '\t' OPTIONALLY ENCLOSED BY '"' LINES STARTING BY 'customer\t' (`customer_id`, `store_id`, `first_name`, `last_name`, `email`, `address_id`, `active`, `create_date`, `last_update`);
	-- Page id: 0-- Page id: 1-- Page id: 2-- Page id: 3, Format: COMPACT, Records list: Invalid, Expected records: (0 4)
	-- Page id: 3, Found records: 0, Lost records: NO, Leaf page: NO
	-- Page id: 4, Format: COMPACT, Records list: Invalid, Expected records: (0 598)
	-- Page id: 4, Found records: 0, Lost records: NO, Leaf page: YES
	-- Page id: 5, Format: COMPACT, Records list: Invalid, Expected records: (0 598)
	-- Page id: 5, Found records: 0, Lost records: NO, Leaf page: YES
	-- Page id: 6, Format: COMPACT, Records list: Invalid, Expected records: (0 598)
	-- Page id: 6, Found records: 0, Lost records: NO, Leaf page: YES
	-- Page id: 7, Format: COMPACT, Records list: Invalid, Expected records: (0 89)
	000000001569    6D0000021F1CED  customer        1       1       "MARY"  "SMITH" "MARY.SMITH@mydbcustomer.org" 5       1       "2006-02-14 22:04:36"   "2006-02-15 04:57:20"
	-- Page id: 7, Found records: 1, Lost records: YES, Leaf page: YES
	-- Page id: 8, Format: COMPACT, Records list: Invalid, Expected records: (0 180)
	-- Page id: 8, Found records: 0, Lost records: NO, Leaf page: YES
	-- Page id: 9, Format: COMPACT, Records list: Invalid, Expected records: (0 180)
	-- Page id: 9, Found records: 0, Lost records: NO, Leaf page: YES
	-- Page id: 10, Format: COMPACT, Records list: Invalid, Expected records: (0 149)
	-- Page id: 10, Found records: 0, Lost records: NO, Leaf page: YES

Nailed it - a single record qualified, and it's the one we're looking for:

	000000001569    6D0000021F1CED  customer        1       1       "MARY"  "SMITH" "MARY.SMITH@mydbcustomer.org" 5       1       "2006-02-14 22:04:36"   "2006-02-15 04:57:20"
```
You've got the hex addresses at the start, followed by the table name, and then the actual data in the order of the columns as they existed in the table. If you want a bit more information, or prefer it formatted line by line, try running =constraints_parser= with the -V flag as well, for verbose output, and grepping for something unique to that row (MARY can coincide with PRIMARY or ROSEMARY, and SMITH is repeated in a number of rows, so MARY.SMITH or even MARYSMITH, grepped with the -20 or -30 flag, will get the desired results in this case):
```
	PAGE7: Found a table customer record: 0x1134b091 (offset = 129)
	Field #1 @ 0x1134b093: length 6, value: 000000001569
	Field #2 @ 0x1134b099: length 7, value: 6D0000021F1CED
	Processing record 0x1134b091 from table 'customer'
	PHYSICAL RECORD: n_fields 11; compact format; info bits 32
	 0: len 2; hex 0001; asc   ;; 1: len 6; hex 000000001569; asc      i;; 2: len 7; hex 6d0000021f1ced; asc m      ;; 3: len 1; hex 01; asc  ;; 4: len 4; hex 4d415259; asc MARY;; 5: len 5; hex 534d495448; asc SMITH;; 6: len 29; hex 4d4152592e534d4954484073616b696c61637573746f6d65722e6f7267; asc MARY.SMITH@mydbcustomer.org;; 7: len 2; hex 0005; asc   ;; 8: len 1; hex 81; asc  ;; 9: len 8; hex 8000123ea1f15694; asc    &gt;  V ;; 10: len 4; hex 43f30910; asc C   ;;
	Field #0 @ 0x1134b091: length 2, value: 1
	Field #3 @ 0x1134b0a0: length 1, value: 1
	Field #4 @ 0x1134b0a1: length 4, value: "MARY"
	Field #5 @ 0x1134b0a5: length 5, value: "SMITH"
	Field #6 @ 0x1134b0aa: length 29, value: "MARY.SMITH@mydbcustomer.org"
	Field #7 @ 0x1134b0c7: length 2, value: 5
	Field #8 @ 0x1134b0c9: length 1, value: 1
	Field #9 @ 0x1134b0ca: length 8, value: "2006-02-14 22:04:36"
	Field #10 @ 0x1134b0d2: length 4, value: "2006-02-15 04:57:20"
```
You'll get a lot of other results with partial data in verbose mode, as it displays basically everything that is being processed, but only one page of data will have the full set of fields you're looking for (for each row that you're attempting to match).

_____________________________________________
## GETTING THE DATA BACK INTO YOUR DATABASE

So, you've got the raw data for one missing row. While that's useful on its own, realistically, there's a good chance that you're going to be dealing with more than just that, and it may not be as well put-together, particularly if you're running into corruption issues. You could take the data that you find piece by piece and reinsert it into the recovery database, or you can use another method to create dump and SQL files to automatically handle this for you.

To do this, you'll want to get your =constraints_parser= output split apart into dump file and SQL statements containing the LOAD DATA information, which can be separated via stderr and stdout. The dump file data is output by =constraints_parser= as stdout, and the LOAD DATA statement is output as stderr. The one thing that =constraints_parser= requires in this respect is that a proper dump folder structure is used, relative to the path that you're currently in, and dependent on whether you specify a database name with the -p flag.
```
	Example with -p:
	./constraints_parser -5 -f /root/innodb.bak/database/table.ibd -p database_recovered
	..will produce a LOAD DATA statement with ./dumps/database_recovered/ as its dump path.

	Example without -p:
	./constraints_parser -5 -f /root/innodb.bak/database/table.ibd
	..will produce a LOAD DATA statement with ./dumps/default/ as its dump path.
```
The dumps are important, because they contain the actual data that the LOAD DATA SQL statement will reference when inserting the data into your recovery database. Because this path isn't created automatically by =constraints_parser=, let's go ahead and set that up, assuming that -p flag will be used with the recovery database specified:
```
	# mkdir -p /root/pdrt/dumps/database_recovered
```
With that set up, we can now run the full =constraints_parser= command with redirects used for stdout and stderr. Because, on occasion it will send "progress percentage" output into stderr as well (eg. 76.6% done), I've also added on a sed command to check for this and remove those lines if they exist. The only concern would be if, for any reason, a column name has the word "done" in it. Feel free to expand on the sed command, as I'm sure there's a better way to match for this without risk of matching a column or table name. The only data that should be in the SQL file that we create via stderr should be recognizable SQL syntax, which is why lines like that must be removed.

Here's a full example using the customer table data from earlier to demonstrate:
```
	./constraints_parser -5 -Df /root/innodb.bak/mydb/customer.ibd -p mydb_recovered &gt; dumps/mydb_recovered/customer 2&gt; customer.sql && sed -i '/done/d' customer.sql
```
Here, we've got the stdout, which contains the actual data, headed into dumps/mydb_recovered/customer, and the stderr, which contains the SQL statements with instructions to load those dumps into a database, going into customer.sql. Now, we can see how those were split up:
```
	# cat customer.sql
	SET FOREIGN_KEY_CHECKS=0;
	LOAD DATA INFILE '/root/pdrt/dumps/mydb_recovered/customer' REPLACE INTO TABLE `customer` FIELDS TERMINATED BY '\t' OPTIONALLY ENCLOSED BY '"' LINES STARTING BY 		'customer\t' (`customer_id`, `store_id`, `first_name`, `last_name`, `email`, `address_id`, `active`, `create_date`, `last_update`);

	# cat ./dumps/mydb_recovered/customer
	-- Page id: 0-- Page id: 1-- Page id: 2-- Page id: 3, Format: COMPACT, Records list: Invalid, Expected records: (0 4)
	-- Page id: 3, Found records: 0, Lost records: NO, Leaf page: NO
	-- Page id: 4, Format: COMPACT, Records list: Invalid, Expected records: (0 598)
	-- Page id: 4, Found records: 0, Lost records: NO, Leaf page: YES
	-- Page id: 5, Format: COMPACT, Records list: Invalid, Expected records: (0 598)
	-- Page id: 5, Found records: 0, Lost records: NO, Leaf page: YES
	-- Page id: 6, Format: COMPACT, Records list: Invalid, Expected records: (0 598)
	-- Page id: 6, Found records: 0, Lost records: NO, Leaf page: YES
	-- Page id: 7, Format: COMPACT, Records list: Invalid, Expected records: (0 89)
	000000001569	6D0000021F1CED	customer	1	1	"MARY"	"SMITH"	"MARY.SMITH@sakilacustomer.org"	5	1	"2006-02-14 22:04:36"	"2006-02-15 04:57:20"
	-- Page id: 7, Found records: 1, Lost records: YES, Leaf page: YES
	-- Page id: 8, Format: COMPACT, Records list: Invalid, Expected records: (0 180)
	-- Page id: 8, Found records: 0, Lost records: NO, Leaf page: YES
	-- Page id: 9, Format: COMPACT, Records list: Invalid, Expected records: (0 180)
	-- Page id: 9, Found records: 0, Lost records: NO, Leaf page: YES
	-- Page id: 10, Format: COMPACT, Records list: Invalid, Expected records: (0 149)
	-- Page id: 10, Found records: 0, Lost records: NO, Leaf page: YES
	-- Page id: 0-- Page id: 0
```
Even with the additional, irrelevant data you see in the dump file, the LOAD DATA statement explicitly defines the import data to begin after the table name, followed by a tab (LINES STARTING BY 'customer\t'), then fields delimited by tabs after that point optionally enclosed in quotations (FIELDS TERMINATED BY '\t' OPTIONALLY ENCLOSED BY '"'), which ensures that only the data you want ends up being loaded.

At this point, you've got these two key files - customer.sql and dumps/mydb_recovered/customer - the next step is to use that sql file to load the data back into your recovered database:
```
	# mysql mydb_recovered &lt; /root/pdrt/customer.sql
```
One thing you may encounter here, is a not-particularly-helpful error about being unable to stat the dump file. It will look something like this:
```
		ERROR 13 (HY000) at line 2: Can't get stat of '/root/pdrt/dumps/mydb_recovered/customer' (Errcode: 13)
```
If you receive this, the fix is to modify the statement to read: "LOAD DATA LOCAL INFILE". It has something to do with the way the MySQL host is treated as local versus potentially remote, as I understand it. A quick command to fix this is:
```
	# sed -i 's/LOAD DATA INFILE/LOAD DATA LOCAL INFILE/g' /root/pdrt/customer.sql
```
Then, re-run the above "mysql mydb_recovered &lt; /root/pdrt/customer.sql" command, and it should process correctly this time.

Now we can confirm the results:
```
	# mysql mydb_recovered
	mysql&gt; select * from customer limit 3;
	+-------------+----------+------------+-----------+-------------------------------------+------------+--------+---------------------+---------------------+
	| customer_id | store_id | first_name | last_name | email                               | address_id | active | create_date         | last_update         |
	+-------------+----------+------------+-----------+-------------------------------------+------------+--------+---------------------+---------------------+
	|           1 |        1 | MARY       | SMITH     | MARY.SMITH@sakilacustomer.org       |          5 |      1 | 2006-02-14 22:04:36 | 2006-02-15 04:57:20 |
	|           2 |        1 | PATRICIA   | JOHNSON   | PATRICIA.JOHNSON@sakilacustomer.org |          6 |      1 | 2006-02-14 22:04:36 | 2006-02-15 04:57:20 |
	|           3 |        1 | LINDA      | WILLIAMS  | LINDA.WILLIAMS@sakilacustomer.org   |          7 |      1 | 2006-02-14 22:04:36 | 2006-02-15 04:57:20 |
	+-------------+----------+------------+-----------+-------------------------------------+------------+--------+---------------------+---------------------+
	3 rows in set (0.00 sec)
```
There it is - Mary Smith in her entirety, each field restored to its original value successfully into the recovered database. So ultimately, these principles can be applied to large-scale restorations as well, with the key factors being both the correct usage of =constraints_parser=, and effective tweaking of =table_defs.h=, so that you can ensure that the output you get from =constraints_parser= contains only what you need from it. Of course, if you get a "close enough" result, there's always the option of loading up the dump file in your favorite editor and simply deleting the lines of data that you don't want restored, leaving only what you'd like to import, and it will work just as well.

```code-walkthrough
language: bash
title: Complete PDRT Recovery Workflow
code: |
  systemctl stop mysql
  cp -a /var/lib/mysql /var/lib/mysql.backup
  cd /opt/pdrt
  ./create_defs.pl --host=localhost --user=root --db=mydb > table_defs/mydb.constraints
  ./constraints_parser -5 -f /var/lib/mysql/mydb/users.ibd -t table_defs/mydb.constraints
  mysql -e "CREATE DATABASE mydb_recovered"
  mysql mydb_recovered < original_schema.sql
  mysql -e "LOAD DATA LOCAL INFILE 'dumps/default/users' INTO TABLE users" mydb_recovered
annotations:
  - line: 1
    text: "Stop MySQL first. You don't want the server modifying files while you're trying to recover data from them."
  - line: 2
    text: "Critical: copy the entire data directory BEFORE any recovery attempt. cp -a preserves permissions and ownership. This is your safety net."
  - line: 4
    text: "create_defs.pl generates a constraints file from the MySQL schema. If MySQL won't start, you'll need to write this manually from a backup of the schema."
  - line: 5
    text: "Run constraints_parser against the .ibd file (file-per-table) or ibdata1 (shared tablespace). The -5 flag specifies the InnoDB page format."
  - line: 6
    text: "Create a fresh database for the recovered data. Never import back into the corrupted database."
  - line: 7
    text: "Apply the original schema (CREATE TABLE statements) to the recovery database. You need matching table structures for the import."
  - line: 8
    text: "LOAD DATA INFILE imports the tab-separated recovery output. Verify row counts match the constraints_parser output."
```

_____________________________________________
## WHERE TO GO FROM HERE

This documentation covered some of the basics when it comes to recovering data, but there are going to undoubtedly be a variety of scenarios you'll run into that are going to require some more in-depth procedures. Ideally, I've tried to cover the foundations so that anything described here can be applied on a larger-scale to accomplish recovery of just about any level. There's certainly quite bit of functionality that the PDRT tool set is capable of that isn't covered here, though, and one of the best ways I can recommend to familiarize yourself with those capabilities is to look right into the source, which you can find here, at their launchpad site containing the latest development builds:

> http://bazaar.launchpad.net/~percona-dev/percona-data-recovery-tool-for-innodb/trunk/files

Additionally, though there are areas of it that don't seem to have been updated to account for the latest build, or even the 0.5 stable release, Percona still has some great tips on their site, which can be found here:

> http://www.percona.com/docs/wiki/innodb-data-recovery-tool:start

In the external resources of their documentation, there is a link to what is described as a video tutorial, but the link was not functional at the time of writing this - however I was able to track down the 3-part series posted to Youtube. Again, some of the techniques shown seem to reference earlier versions, or features that do not seem to function as displayed in either 0.5 or the development build, but it can still be a helpful way to see recovery via PDRT demonstrated visually. Part 1 can be found here:

> https://www.youtube.com/watch?v=gkiztClZses

Of course, failing all of the above, there are manual methods of recovery without the use of toolsets, though that may be documentation for another time. If you'd like to jump the gun, here are some handy links that may get you started on that:

* Recovering single InnoDB table from a backup: http://www.mysqlperformanceblog.com/2012/01/25/how-to-recover-a-single-innodb-table-from-a-full-backup/
* Great explanation of some manual recovery options: http://dba.stackexchange.com/questions/42495/how-to-recover-restore-corrupted-innodb-data-files
* One of my favorites - a flowchart providing in-depth insight on how InnoDB really operates behind the scenes: http://i.stack.imgur.com/9EcRi.jpg

---

## Further Reading

- [MySQL Documentation](https://dev.mysql.com/doc/) - official MySQL reference manual
- [Percona Software](https://www.percona.com/software/mysql-database) - Percona tools for MySQL database recovery and management
